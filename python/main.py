import os
import platform
import signal
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path

from console_output import error, info, success, warning
from moomoo_export import (
    configure_moomoo_console_logging,
    export_account_data_for_web,
    get_trade_context,
    moomoo_is_running,
)

MOOMOO_HOST = "127.0.0.1"
MOOMOO_PORT = 11111
MOOMOO_APP_NAME = "moomoo_OpenD"
MOOMOO_PROCESS_NAME = "moomoo_OpenD"
MOOMOO_STARTUP_TIMEOUT_SECONDS = 60.0
MOOMOO_READY_PROCESS_TIMEOUT_SECONDS = 15.0
MOOMOO_SHUTDOWN_TIMEOUT_SECONDS = 15.0
MOOMOO_FORCE_SHUTDOWN_TIMEOUT_SECONDS = 5.0


@dataclass
class OpenDLaunchState:
    started_by_script: bool = False
    export_started: bool = False
    initial_pids: set[int] = field(default_factory=set)
    app_path: Path | None = None


def _candidate_opend_paths() -> list[Path]:
    candidates: list[Path] = []
    configured_path = os.getenv("MOOMOO_OPEND_APP_PATH")
    if configured_path:
        candidates.append(Path(configured_path).expanduser())

    candidates.extend(
        [
            Path("/Applications/moomoo_OpenD.app"),
            Path.home() / "Applications" / "moomoo_OpenD.app",
            Path("/Applications/moomoo_OpenD.app/Contents/MacOS/moomoo_OpenD"),
            Path.home() / "Applications/moomoo_OpenD.app/Contents/MacOS/moomoo_OpenD",
        ]
    )
    return candidates


def _resolve_opend_path() -> Path:
    checked_paths: list[Path] = []
    for candidate in _candidate_opend_paths():
        checked_paths.append(candidate)
        if candidate.is_dir() and candidate.suffix == ".app":
            return candidate
        if candidate.is_file():
            return candidate

    searched = ", ".join(str(path) for path in checked_paths)
    raise FileNotFoundError(
        "Unable to locate moomoo_OpenD.app. "
        f"Set MOOMOO_OPEND_APP_PATH or install it in one of: {searched}"
    )


def _find_moomoo_pids() -> set[int]:
    pid_patterns = [
        ["pgrep", "-x", MOOMOO_PROCESS_NAME],
        ["pgrep", "-f", f"/{MOOMOO_APP_NAME}.app/Contents/MacOS/{MOOMOO_PROCESS_NAME}"],
    ]
    pids: set[int] = set()

    for command in pid_patterns:
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=False,
            )
        except FileNotFoundError:
            break

        if result.returncode not in (0, 1):
            continue

        for line in result.stdout.splitlines():
            line = line.strip()
            if line.isdigit():
                pids.add(int(line))

    return pids


def _wait_for_opend_ready(timeout_seconds: float) -> bool:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if moomoo_is_running(
            host=MOOMOO_HOST,
            port=MOOMOO_PORT,
            timeout=0,
            retry_delay=0.25,
        ):
            return True
        time.sleep(0.5)

    return moomoo_is_running(
        host=MOOMOO_HOST,
        port=MOOMOO_PORT,
        timeout=0,
        retry_delay=0.25,
    )


def _wait_for_opend_shutdown(timeout_seconds: float) -> bool:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if not _find_moomoo_pids() and not moomoo_is_running(
            host=MOOMOO_HOST,
            port=MOOMOO_PORT,
            timeout=0,
            retry_delay=0.25,
        ):
            return True
        time.sleep(0.5)

    return not _find_moomoo_pids() and not moomoo_is_running(
        host=MOOMOO_HOST,
        port=MOOMOO_PORT,
        timeout=0,
        retry_delay=0.25,
    )


def _launch_opend(app_path: Path) -> None:
    if platform.system() != "Darwin":
        raise RuntimeError(
            "Automatic launch of moomoo_OpenD is only supported on macOS. "
            "Please start Moomoo OpenD manually."
        )

    if app_path.suffix == ".app":
        result = subprocess.run(
            ["open", str(app_path)],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            stderr = result.stderr.strip() or "unknown launch error"
            raise RuntimeError(f"Failed to launch {app_path}: {stderr}")
        return

    try:
        subprocess.Popen(
            [str(app_path)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
    except OSError as exc:
        raise RuntimeError(f"Failed to launch {app_path}: {exc}") from exc


def ensure_moomoo_opend_ready(state: OpenDLaunchState) -> None:
    if moomoo_is_running(
        host=MOOMOO_HOST,
        port=MOOMOO_PORT,
        timeout=0,
        retry_delay=0.25,
    ):
        success("OpenD", f"Already running on {MOOMOO_HOST}:{MOOMOO_PORT}")
        return

    state.initial_pids = _find_moomoo_pids()
    if state.initial_pids:
        info("OpenD", f"Process detected, waiting for {MOOMOO_HOST}:{MOOMOO_PORT}")
        if _wait_for_opend_ready(MOOMOO_READY_PROCESS_TIMEOUT_SECONDS):
            success("OpenD", f"Ready on {MOOMOO_HOST}:{MOOMOO_PORT}")
            return

        raise RuntimeError(
            "Detected a running moomoo_OpenD process, but it never became ready on "
            f"{MOOMOO_HOST}:{MOOMOO_PORT}. Finish logging in to OpenD and try again."
        )

    state.app_path = _resolve_opend_path()
    info("OpenD", f"Launching from {state.app_path}")
    _launch_opend(state.app_path)
    state.started_by_script = True

    if not _wait_for_opend_ready(MOOMOO_STARTUP_TIMEOUT_SECONDS):
        raise RuntimeError(
            "Launched moomoo_OpenD, but it did not open port "
            f"{MOOMOO_PORT} within {MOOMOO_STARTUP_TIMEOUT_SECONDS:.0f} seconds. "
            "Make sure OpenD finishes launching and that you are logged in."
        )

    success("OpenD", f"Ready on {MOOMOO_HOST}:{MOOMOO_PORT}")


def _terminate_pids(pids: set[int], sig: int) -> None:
    for pid in pids:
        try:
            os.kill(pid, sig)
        except ProcessLookupError:
            continue


def shutdown_moomoo_opend(state: OpenDLaunchState) -> None:
    if not state.started_by_script:
        return

    info("OpenD", "Stopping")

    if platform.system() == "Darwin":
        subprocess.run(
            ["osascript", "-e", f'tell application "{MOOMOO_APP_NAME}" to quit'],
            capture_output=True,
            text=True,
            check=False,
        )

    if _wait_for_opend_shutdown(MOOMOO_SHUTDOWN_TIMEOUT_SECONDS):
        success("OpenD", "Stopped")
        return

    remaining_pids = _find_moomoo_pids()
    if remaining_pids:
        warning("OpenD", "Did not exit cleanly, sending SIGTERM")
        _terminate_pids(remaining_pids, signal.SIGTERM)

    if _wait_for_opend_shutdown(MOOMOO_SHUTDOWN_TIMEOUT_SECONDS):
        success("OpenD", "Stopped")
        return

    remaining_pids = _find_moomoo_pids()
    if remaining_pids:
        warning("OpenD", "Ignored SIGTERM, sending SIGKILL")
        _terminate_pids(remaining_pids, signal.SIGKILL)

    if _wait_for_opend_shutdown(MOOMOO_FORCE_SHUTDOWN_TIMEOUT_SECONDS):
        success("OpenD", "Stopped")
        return

    raise RuntimeError(
        "moomoo_OpenD was started by this script but could not be stopped cleanly. "
        "Please close it manually."
    )


def main():
    configure_moomoo_console_logging()
    launch_state = OpenDLaunchState()
    trd_ctx = None
    main_error: BaseException | None = None

    try:
        ensure_moomoo_opend_ready(launch_state)

        info("Trade Context", "Opening connection to Moomoo OpenD")
        trd_ctx = get_trade_context()
        success("Trade Context", "Connection established")

        launch_state.export_started = True
        export_account_data_for_web(trd_ctx=trd_ctx)
    except BaseException as exc:
        main_error = exc
        raise
    finally:
        if trd_ctx is not None:
            try:
                trd_ctx.close()
                info("Trade Context", "Closed")
            except Exception as exc:
                if main_error is None:
                    raise
                warning("Trade Context", f"Failed to close cleanly: {exc}")

        if launch_state.started_by_script and launch_state.export_started:
            try:
                shutdown_moomoo_opend(launch_state)
            except Exception as exc:
                if main_error is None:
                    raise
                error("OpenD", f"Failed to stop cleanly: {exc}")


if __name__ == "__main__":
    main()
