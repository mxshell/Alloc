# Alloc

Stock Portfolio Visualization made for [FUTU/Moomoo](https://www.moomoo.com/) users.

## Read Me First

This is a web app that visualizes your stock portfolio data purely from the browser-side (client-side, locally). It does not require any server-side processing or database.

[FUTU/Moomoo](https://www.moomoo.com/) does not provide proper scope-managed API for third-party apps. Thus, for 100% security and privacy, this app does not ask for any account credentials or tokens. Instead, it relies on you to export your portfolio data via moomoo's official API yourself. We provide a simple script to do that and the script doesn't handle any part of the authentication.

Read the following section for step-by-step instructions.

## Exporting Portfolio Data

### Prerequisites

-   You need to be a [FUTU/Moomoo](https://www.moomoo.com/) user with an active account, anywhere in the world (incl. US, HK, SG, etc.).

### Step 1: Setup Moomoo API Client Locally

1. Download the latest [moomoo OpenD GUI Client](https://www.moomoo.com/download/OpenAPI?_ga=2.228072795.755266222.1765942756-812069572.1761661575&_gac=1.190289369.1765944929.Cj0KCQiAo4TKBhDRARIsAGW29bdGCT3yyW5G99CEqHuhi0rb6N6xPiw4oVzmKEURl0xcbzfzn8wOFo8aAmzkEALw_wcB&chain_id=KXCd6VRrpQ6J-S.1kk4cl5&global_content=%7B%22promote_id%22%3A1010,%22sub_promote_id%22%3A344,%22f%22%3A%22mm%2Fsg%2Fsupport%2Ftopic3_441%22%7D) to your local machine.
    - Choose `moomoo OpenAPI` > `moomoo OpenD` > Latest Version.
    - Note that you are downloading `moomoo OpenD` instead of `moomoo API`.
    - After downloading, run the installer and follow the instructions to install it.
2. Run the `moomoo OpenD` client and login to your [FUTU/Moomoo](https://www.moomoo.com/) account.
    - Use all default settings and login with your account credentials. By default, it should have parameters like:
        - `IP`: `127.0.0.1`
        - `Port`: `11111`
    - When you login for the first time on a new device, it will ask you to authenticate via 2FA. Save your login details and check the automatic login checkbox will allow you to login smoothly next time.
    - Once you are logged in, leave it running in the background.

### Step 2: Run the Export Script

1. Clone this repository:

    ```bash
    git clone https://github.com/mxshell/Alloc.git
    cd Alloc
    ```

2. Set up the Python environment:

    ```bash
    cd python
    uv sync
    ```

3. Run the export script:

    ```bash
    uv run moomoo_export.py
    ```

    - After the script is done, you will find the exported data (a single JSON file) in the `python` directory.
    - Once you have the exported data, you can close/terminate the `moomoo OpenD` client.

## Run `Alloc` Web App Locally

**Environment:**

-   `Node.js`
-   `pnpm` (optional, but recommended)

**Commands:**

1. Install app dependencies:
   `pnpm install` or `npm install`
2. Run the app:
   `pnpm run dev` or `npm run dev`

## Using `Alloc` Web App

1. Open the `Alloc` web app in your browser.
    - Publicly hosted at [https://mxshell.dev/Alloc](https://mxshell.dev/Alloc/)
    - or use your locally hosted app by opening [http://localhost:3000](http://localhost:3000) in your browser.
2. Simply drag and drop the exported JSON file into the app.
