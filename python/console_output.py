from rich.console import Console

console = Console()


def info(scope: str, message: str) -> None:
    console.print(f"[bold cyan]{scope}:[/bold cyan] {message}")


def success(scope: str, message: str) -> None:
    console.print(f"[bold green]{scope}:[/bold green] {message}")


def warning(scope: str, message: str) -> None:
    console.print(f"[bold yellow]{scope}:[/bold yellow] {message}")


def error(scope: str, message: str) -> None:
    console.print(f"[bold red]{scope}:[/bold red] {message}")


def detail(label: str, value: str) -> None:
    console.print(f"  [dim]{f'{label}:':<12}[/dim] {value}")


def blank_line() -> None:
    console.print()
