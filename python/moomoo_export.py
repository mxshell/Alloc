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

import socket
import time
from datetime import datetime
from pathlib import Path

import moomoo as ft
import pandas as pd
from moomoo.common.constant import (
    Currency,
    RET_OK,
    SecurityFirm,
    TrdMarket,
)
from rich import print

import json

THIS_DIR = Path(__file__).parent


def moomoo_is_running(
    host: str = "127.0.0.1",
    port: int = 11111,
    timeout: float = 3,
    retry_delay: float = 0.5,
) -> bool:
    """
    Check if Moomoo OpenD is running, by checking if the port 11111 is open.
    """
    for _ in range(int(timeout / retry_delay)):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(retry_delay)
                s.connect((host, port))
                return True
        except socket.error:
            pass
        time.sleep(retry_delay)

    return False


def get_trade_context() -> ft.OpenSecTradeContext:
    if not moomoo_is_running():
        print(
            "[red bold]Moomoo OpenD is not running. Please run Moomoo OpenD locally at port 11111 and try again.[/red bold]"
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
        print("get_acc_list error: ", data)
        return []


def export_account_data_for_web(
    trd_ctx: ft.OpenSecTradeContext,
    acc_id: str = None,
    export_to_file: bool = True,
):
    if acc_id is None:
        acc_ids = get_accounts(trd_ctx=trd_ctx)

    for acc_id in acc_ids:

        positions_data = None
        account_data = None

        print(f"Querying account: '{acc_id}'")

        ret, positions_data = trd_ctx.position_list_query(
            acc_id=acc_id, refresh_cache=True
        )
        if ret == RET_OK and positions_data.shape[0] > 0:
            positions_data: pd.DataFrame
            num_positions = positions_data.shape[0]
            print(
                f"  [green bold]➜ Success[/green bold] {num_positions} positions found."
            )

        ret, account_data = trd_ctx.accinfo_query(
            acc_id=acc_id, currency=Currency.USD, refresh_cache=True
        )
        if ret == RET_OK and account_data.shape[0] > 0:
            account_data: pd.DataFrame
            total_assets_value = account_data["total_assets"].values[0]
            print(
                f"  [green bold]➜ Total assets value:[/green bold] ${total_assets_value:.2f}"
            )

        if total_assets_value <= 0.1:
            print(f"  [red bold]➜ Skip inactive account '{acc_id}'[/red bold]")
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
            print(f"  [green bold]➜ Success[/green bold] Data exported to '{out_path}'")


if __name__ == "__main__":
    trd_ctx = None
    try:
        print(f"Acquiring trade context from Moomoo OpenD...")
        trd_ctx = get_trade_context()
        print(f"Trade context acquired.")

        export_account_data_for_web(trd_ctx=trd_ctx)
    except Exception as e:
        raise e
    finally:
        if trd_ctx is not None:
            trd_ctx.close()
            print("Trade Context has been closed.")
