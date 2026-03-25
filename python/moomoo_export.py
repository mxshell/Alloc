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
import socket
import time
from datetime import datetime
from pathlib import Path

import moomoo as ft
import pandas as pd
from moomoo.common.constant import RET_OK, Currency, SecurityFirm, TrdMarket

from console_output import blank_line, detail, error, info, success, warning

THIS_DIR = Path(__file__).parent


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
                json.dump(data, f, indent=4)
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
    except Exception as e:
        raise e
    finally:
        if trd_ctx is not None:
            trd_ctx.close()
            info("Trade Context", "Closed")
