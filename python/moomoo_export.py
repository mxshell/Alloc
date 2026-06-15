"""
Running this script requires Moomoo OpenD to be running locally.

## Install Moomoo OpenD GUI

OpenAPI > Moomoo OpenD > OpenD GUI

- [https://www.moomoo.com/sg/download](https://www.moomoo.com/sg/download)

## Run OpenD Locally

Launch `moomoo_OpenD.app` and login with your Moomoo account.

## Run Script

```bash
python moomoo_export.py
```
"""

import json
import logging
import math
import os
import socket
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import moomoo as ft
import pandas as pd
from moomoo.common.constant import RET_OK, Currency, SecurityFirm, TrdEnv, TrdMarket

from console_output import blank_line, detail, error, info, success, warning

THIS_DIR = Path(__file__).parent
DEALS_SCHEMA_VERSION = 1
DEALS_INITIAL_START_DATE_ENV = "MOOMOO_DEALS_START_DATE"
DEALS_DEFAULT_START_DATE = "2020-01-01 00:00:00"
DEALS_QUERY_WINDOW_DAYS = 90
DEALS_QUERY_OVERLAP_DAYS = 5
DEALS_REQUEST_LIMIT = 10
DEALS_REQUEST_LIMIT_SECONDS = 30.0


def configure_moomoo_console_logging(level: int = logging.WARNING) -> None:
    logger = getattr(ft, "logger", None)
    if logger is None:
        return

    try:
        logger.console_level = level
    except Exception:
        pass


def moomoo_is_running(
    host: str = "127.0.0.1",
    port: int = 11111,
    timeout: float = 3,
    retry_delay: float = 0.5,
) -> bool:
    """
    Check if Moomoo OpenD is running, by checking if the port 11111 is open.
    """
    timeout = max(timeout, 0.0)
    retry_delay = max(retry_delay, 0.05)
    socket_timeout = max(min(retry_delay, 1.0), 0.1)
    deadline = time.monotonic() + timeout

    while True:
        try:
            with socket.create_connection((host, port), timeout=socket_timeout):
                return True
        except OSError:
            if time.monotonic() >= deadline:
                return False
            time.sleep(min(retry_delay, max(deadline - time.monotonic(), 0.0)))


def get_trade_context() -> ft.OpenSecTradeContext:
    if not moomoo_is_running():
        error(
            "OpenD",
            "Moomoo OpenD is not running on 127.0.0.1:11111. Start it and try again.",
        )
        raise RuntimeError("Moomoo OpenD is not running.")

    trd_ctx = ft.OpenSecTradeContext(
        filter_trdmarket=TrdMarket.US,
        host="127.0.0.1",
        port=11111,
        security_firm=SecurityFirm.FUTUSG,
    )
    return trd_ctx


def get_quote_context():
    quote_ctx = ft.OpenQuoteContext(
        host="127.0.0.1",
        port=11111,
    )
    return quote_ctx


def get_accounts(trd_ctx: ft.OpenSecTradeContext):
    """
    Get the list of real trading accounts IDs from the user's account.

    Args:
        trd_ctx (ft.OpenSecTradeContext): Trade Context

    Returns:
        list: List of real trading account IDs
    """
    ret, data = trd_ctx.get_acc_list()
    if ret == RET_OK:
        # get accounts with trd_env is 'REAL' only
        real_accounts = data[data["trd_env"] == "REAL"]
        acc_ids = real_accounts["acc_id"].values.tolist()
        return acc_ids
    else:
        warning("Accounts", f"Unable to fetch trading accounts: {data}")
        return []


def _parse_moomoo_datetime(value: Any) -> datetime | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.replace(tzinfo=None)

    if isinstance(value, pd.Timestamp):
        return value.to_pydatetime().replace(tzinfo=None)

    value_text = str(value).strip()
    if not value_text or value_text.upper() in {"N/A", "NONE", "NAT"}:
        return None

    for candidate in (
        value_text,
        value_text.replace("/", "-"),
    ):
        try:
            return datetime.fromisoformat(candidate).replace(tzinfo=None)
        except ValueError:
            pass

    for date_format in (
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%Y/%m/%d %H:%M:%S.%f",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d",
    ):
        try:
            return datetime.strptime(value_text, date_format)
        except ValueError:
            pass

    return None


def _format_moomoo_datetime(value: datetime) -> str:
    return value.replace(microsecond=0).strftime("%Y-%m-%d %H:%M:%S")


def _to_jsonable(value: Any) -> Any:
    if value is None:
        return None

    if isinstance(value, float) and math.isnan(value):
        return None

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if isinstance(value, pd.Timestamp):
        return value.isoformat()

    if isinstance(value, dict):
        return {str(key): _to_jsonable(item) for key, item in value.items()}

    if isinstance(value, (list, tuple)):
        return [_to_jsonable(item) for item in value]

    if hasattr(value, "item"):
        try:
            return _to_jsonable(value.item())
        except (TypeError, ValueError):
            pass

    try:
        json.dumps(value)
        return value
    except (TypeError, ValueError):
        return str(value)


def _dataframe_to_records(dataframe: pd.DataFrame) -> list[dict[str, Any]]:
    if dataframe.empty:
        return []

    normalized = dataframe.astype(object).where(pd.notna(dataframe), None)
    return [
        {str(key): _to_jsonable(value) for key, value in record.items()}
        for record in normalized.to_dict(orient="records")
    ]


def _account_deals_path(acc_id: str | int, output_dir: Path = THIS_DIR) -> Path:
    short_acc_id = str(acc_id)[-4:]
    return output_dir / f"account_{short_acc_id}_all_deals.json"


def _empty_account_deals_store(acc_id: str) -> dict[str, Any]:
    return {
        "schema_version": DEALS_SCHEMA_VERSION,
        "updated_at": None,
        "acc_id": str(acc_id),
        "latest_deal_time": None,
        "last_synced_at": None,
        "deal_count": 0,
        "deals": [],
    }


def _load_account_deals_store(acc_id: str, path: Path) -> dict[str, Any]:
    if not path.exists():
        return _empty_account_deals_store(acc_id=acc_id)

    try:
        with open(path) as f:
            store = json.load(f)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Unable to parse existing deals file {path}: {exc}") from exc

    if not isinstance(store, dict):
        raise RuntimeError(f"Existing deals file {path} must contain a JSON object.")

    return _normalize_account_deals_store(account_store=store, acc_id=acc_id)


def _write_account_deals_store(store: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_name(f"{path.name}.tmp")
    with open(tmp_path, "w") as f:
        json.dump(store, f, indent=4, default=_to_jsonable)
        f.write("\n")
    tmp_path.replace(path)


def _normalize_account_deals_store(
    account_store: Any,
    acc_id: str,
) -> dict[str, Any]:
    if isinstance(account_store, list):
        account_store = {"deals": account_store}
    elif not isinstance(account_store, dict):
        account_store = {}

    deals = account_store.get("deals", [])
    if not isinstance(deals, list):
        deals = []

    account_store["acc_id"] = str(account_store.get("acc_id") or acc_id)
    account_store["deals"] = [deal for deal in deals if isinstance(deal, dict)]
    account_store.setdefault("latest_deal_time", None)
    account_store.setdefault("last_synced_at", None)
    account_store["deal_count"] = len(account_store["deals"])
    return account_store


def _latest_deal_time(deals: list[dict[str, Any]]) -> datetime | None:
    latest: datetime | None = None
    for deal in deals:
        deal_time = _parse_moomoo_datetime(deal.get("create_time"))
        if deal_time is not None and (latest is None or deal_time > latest):
            latest = deal_time
    return latest


def _deal_sync_start_datetime(
    account_store: dict[str, Any],
    existing_deals: list[dict[str, Any]],
) -> datetime:
    latest_deal_time = _latest_deal_time(existing_deals)
    if latest_deal_time is not None:
        return latest_deal_time - timedelta(days=DEALS_QUERY_OVERLAP_DAYS)

    last_synced_at = _parse_moomoo_datetime(account_store.get("last_synced_at"))
    if last_synced_at is not None:
        return last_synced_at - timedelta(days=DEALS_QUERY_OVERLAP_DAYS)

    return _initial_deals_start_datetime()


def _deal_key(deal: dict[str, Any]) -> str:
    deal_id = deal.get("deal_id")
    if deal_id not in (None, ""):
        return f"deal_id:{deal_id}"

    fallback_parts = [
        deal.get("order_id"),
        deal.get("code"),
        deal.get("create_time"),
        deal.get("qty"),
        deal.get("price"),
        deal.get("trd_side"),
    ]
    return "fallback:" + "|".join(
        "" if part is None else str(part) for part in fallback_parts
    )


def _normalize_deal_record(record: dict[str, Any], acc_id: str) -> dict[str, Any]:
    normalized = {str(key): _to_jsonable(value) for key, value in record.items()}
    normalized["acc_id"] = str(acc_id)

    for key in ("deal_id", "order_id"):
        if normalized.get(key) is not None:
            normalized[key] = str(normalized[key])

    if normalized.get("create_time") is not None:
        normalized["create_time"] = str(normalized["create_time"])

    return normalized


def _initial_deals_start_datetime() -> datetime:
    configured_start = os.getenv(DEALS_INITIAL_START_DATE_ENV, DEALS_DEFAULT_START_DATE)
    start_datetime = _parse_moomoo_datetime(configured_start)
    if start_datetime is None:
        raise RuntimeError(
            f"{DEALS_INITIAL_START_DATE_ENV} must be a date like "
            "2024-01-01 or 2024-01-01 00:00:00."
        )
    return start_datetime


def _iter_deal_query_ranges(
    start_datetime: datetime,
    end_datetime: datetime,
) -> list[tuple[datetime, datetime]]:
    if start_datetime > end_datetime:
        return [(end_datetime, end_datetime)]

    ranges: list[tuple[datetime, datetime]] = []
    range_start = start_datetime
    while range_start < end_datetime:
        range_end = min(
            range_start + timedelta(days=DEALS_QUERY_WINDOW_DAYS),
            end_datetime,
        )
        ranges.append((range_start, range_end))
        if range_end >= end_datetime:
            break
        range_start = range_end

    if not ranges:
        ranges.append((start_datetime, end_datetime))

    return ranges


def _wait_for_deal_rate_limit(
    request_times: list[float],
    acc_id: str,
) -> None:
    now = time.monotonic()
    request_times[:] = [
        request_time
        for request_time in request_times
        if now - request_time < DEALS_REQUEST_LIMIT_SECONDS
    ]

    if len(request_times) < DEALS_REQUEST_LIMIT:
        return

    sleep_seconds = DEALS_REQUEST_LIMIT_SECONDS - (now - request_times[0]) + 0.5
    if sleep_seconds > 0:
        detail(
            "Rate limit",
            f"sleeping {sleep_seconds:.1f}s before querying account {acc_id}",
        )
        time.sleep(sleep_seconds)

    now = time.monotonic()
    request_times[:] = [
        request_time
        for request_time in request_times
        if now - request_time < DEALS_REQUEST_LIMIT_SECONDS
    ]


def _query_historical_deals(
    trd_ctx: ft.OpenSecTradeContext,
    api_acc_id: Any,
    account_id: str,
    start_datetime: datetime,
    end_datetime: datetime,
) -> tuple[list[dict[str, Any]], int]:
    deals: list[dict[str, Any]] = []
    request_count = 0
    request_times: list[float] = []

    for range_start, range_end in _iter_deal_query_ranges(
        start_datetime=start_datetime,
        end_datetime=end_datetime,
    ):
        _wait_for_deal_rate_limit(request_times=request_times, acc_id=account_id)
        request_times.append(time.monotonic())
        request_count += 1

        ret, data = trd_ctx.history_deal_list_query(
            start=_format_moomoo_datetime(range_start),
            end=_format_moomoo_datetime(range_end),
            trd_env=TrdEnv.REAL,
            acc_id=api_acc_id,
            deal_market=TrdMarket.NONE,
        )
        if ret != RET_OK:
            raise RuntimeError(
                f"history_deal_list_query failed for account {account_id} "
                f"from {_format_moomoo_datetime(range_start)} to "
                f"{_format_moomoo_datetime(range_end)}: {data}"
            )

        deals.extend(
            _normalize_deal_record(record=record, acc_id=account_id)
            for record in _dataframe_to_records(data)
        )

    return deals, request_count


def _merge_deals(
    existing_deals: list[dict[str, Any]],
    fetched_deals: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], int]:
    merged_by_key = {
        _deal_key(deal): deal for deal in existing_deals if isinstance(deal, dict)
    }
    existing_keys = set(merged_by_key)

    fetched_by_key = {
        _deal_key(deal): deal for deal in fetched_deals if isinstance(deal, dict)
    }
    new_count = len(set(fetched_by_key) - existing_keys)
    merged_by_key.update(fetched_by_key)

    return (
        sorted(
            merged_by_key.values(),
            key=lambda deal: (
                _parse_moomoo_datetime(deal.get("create_time")) or datetime.min,
                str(deal.get("deal_id") or ""),
            ),
            reverse=True,
        ),
        new_count,
    )


def export_trade_deals_for_web(
    trd_ctx: ft.OpenSecTradeContext,
    acc_id: str | int | None = None,
    export_to_file: bool = True,
    output_dir: Path = THIS_DIR,
) -> list[dict[str, Any]] | None:
    acc_ids = [acc_id] if acc_id is not None else get_accounts(trd_ctx=trd_ctx)
    if not acc_ids:
        warning("Deals", "No real trading accounts found.")
        return None

    synced_accounts: list[dict[str, Any]] = []

    for raw_acc_id in acc_ids:
        account_id = str(raw_acc_id)
        deals_path = _account_deals_path(acc_id=account_id, output_dir=output_dir)
        account_store = _load_account_deals_store(
            acc_id=account_id,
            path=deals_path,
        )
        existing_deals = account_store["deals"]
        start_datetime = _deal_sync_start_datetime(
            account_store=account_store,
            existing_deals=existing_deals,
        )
        end_datetime = datetime.now()

        blank_line()
        info("Deals", account_id)
        detail("Local", f"{len(existing_deals)} deals")
        detail(
            "Query",
            f"{_format_moomoo_datetime(start_datetime)} to "
            f"{_format_moomoo_datetime(end_datetime)}",
        )

        try:
            fetched_deals, request_count = _query_historical_deals(
                trd_ctx=trd_ctx,
                api_acc_id=raw_acc_id,
                account_id=account_id,
                start_datetime=start_datetime,
                end_datetime=end_datetime,
            )
        except RuntimeError as exc:
            warning("Deals", str(exc))
            continue

        merged_deals, new_count = _merge_deals(
            existing_deals=existing_deals,
            fetched_deals=fetched_deals,
        )
        latest_merged_deal_time = _latest_deal_time(merged_deals)
        synced_at = _format_moomoo_datetime(datetime.now())

        account_store.update(
            {
                "schema_version": DEALS_SCHEMA_VERSION,
                "updated_at": synced_at,
                "acc_id": account_id,
                "last_synced_at": synced_at,
                "latest_deal_time": (
                    _format_moomoo_datetime(latest_merged_deal_time)
                    if latest_merged_deal_time is not None
                    else None
                ),
                "deal_count": len(merged_deals),
                "deals": merged_deals,
            }
        )
        synced_accounts.append(account_store)

        detail("Requests", str(request_count))
        detail("Fetched", str(len(fetched_deals)))
        detail("New", str(new_count))
        detail("Total", str(len(merged_deals)))

        if export_to_file:
            _write_account_deals_store(store=account_store, path=deals_path)
            detail("Exported", str(deals_path))
            detail("Status", "deal sync complete")

    return synced_accounts


def export_account_data_for_web(
    trd_ctx: ft.OpenSecTradeContext,
    acc_id: str = None,
    export_to_file: bool = True,
):
    acc_ids = [acc_id] if acc_id is not None else get_accounts(trd_ctx=trd_ctx)
    if not acc_ids:
        warning("Accounts", "No real trading accounts found.")
        return

    for acc_id in acc_ids:
        positions_data = pd.DataFrame()
        account_data = None
        total_assets_value = 0.0

        blank_line()
        info("Account", str(acc_id))

        ret, positions_data = trd_ctx.position_list_query(
            acc_id=acc_id, refresh_cache=True
        )
        if ret == RET_OK:
            positions_data: pd.DataFrame
            num_positions = positions_data.shape[0]
            detail("Positions", str(num_positions))
        else:
            warning(
                "Positions",
                f"Unable to query positions for account {acc_id}: {positions_data}",
            )
            positions_data = pd.DataFrame()
            detail("Positions", "unavailable")

        ret, account_data = trd_ctx.accinfo_query(
            acc_id=acc_id, currency=Currency.USD, refresh_cache=True
        )
        if ret == RET_OK and account_data.shape[0] > 0:
            account_data: pd.DataFrame
            total_assets_value = float(account_data["total_assets"].values[0] or 0.0)
            detail("Assets", f"${total_assets_value:,.2f}")
        else:
            warning(
                "Assets",
                f"Unable to query account summary for account {acc_id}: {account_data}",
            )
            continue

        if total_assets_value <= 0.1:
            detail("Status", "inactive account, skipped")
            continue

        # convert data frame to dictionary
        positions_data: list[dict] = positions_data.to_dict(orient="records")
        account_data: dict = account_data.to_dict(orient="records")[0]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        data = dict(timestamp=timestamp, account=account_data, positions=positions_data)

        if export_to_file:
            short_acc_id = str(acc_id)[-4:]
            out_path = THIS_DIR / f"account_{short_acc_id}_data_{timestamp}.json"
            with open(out_path, "w") as f:
                json.dump(data, f, indent=4, default=_to_jsonable)
            detail("Exported", str(out_path))
            detail("Status", "export complete")


if __name__ == "__main__":
    configure_moomoo_console_logging()
    trd_ctx = None
    try:
        info("Trade Context", "Opening connection to Moomoo OpenD")
        trd_ctx = get_trade_context()
        success("Trade Context", "Connection established")

        export_account_data_for_web(trd_ctx=trd_ctx)
        export_trade_deals_for_web(trd_ctx=trd_ctx)
    except Exception as e:
        raise e
    finally:
        if trd_ctx is not None:
            trd_ctx.close()
            info("Trade Context", "Closed")
