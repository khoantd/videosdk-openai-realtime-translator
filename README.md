# AI Translator Agent using VideoSDK and OpenAI Realtime API

This project integrates VideoSDK, OpenAI Realtime APIs to create an AI Translator Agent. Below are the setup instructions.

### Start with the project

```sh
git clone https://github.com/videosdk-community/videosdk-openai-realtime-translator.git
```

```sh
cd videosdk-openai-realtime-translator
```

### Client Setup

1. Navigate to `client` dir:
   ```sh
   cd client
   ```
2. Make a copy of the environment configuration file:

   ```sh
   cp .env.example .env
   ```

3. Create a `.env` file in the `client` folder with:

   ```env
   VITE_APP_VIDEOSDK_TOKEN=your_videosdk_auth_token_here
   ```

Obtain your VideoSDK Auth Token from [app.videosdk.live](https://app.videosdk.live)

### Server Setup (Python FastAPI)

Create Virtual Environment (from project root):

```sh
python -m venv .venv
```

Create a virtual environment:

Install Dependencies:

```sh
pip install -r requirements.txt
```

Create Server Environment File (in project root):

```sh
cp .env.example .env
```

Add these keys to your `.env` file:

```sh
OPENAI_API_KEY=your_openai_key_here
```

🔑 Obtaining API Keys

- **OpenAI**: [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **VideoSDK Token**: [https://app.videosdk.live](https://app.videosdk.live)

---

### ▶️ Running the Application

Start the Server (From Project Root):

```sh
uvicorn app:app
```

Start the Client (From `/client` Folder):

```sh
npm run dev
```

---

For more information, check out [docs.videosdk.live](https://docs.videosdk.live).
