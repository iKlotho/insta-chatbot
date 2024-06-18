# Movie Identifier Chat Bot

## Overview

This project contains a chat bot that can identify movies or series based on images or clips provided by users. The bot leverages OpenAI 4o model to run predictions.

## Features

- Accepts reels or images from users
- Predicts the movie or series from the provided media
- Ensures users are following the account to use the bot
- Enforces a rate limit of 1 request per 3 minutes per user

## Configuration

Ensure you have the following environment variables;

```
IG_USERNAME=
IG_PASSWORD=
OPENAI_API_KEY=
```

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/iKlotho/insta-chatbot.git
   cd insta-chatbot
   npm install
   export (cat .env |xargs -L 1)
   npm run start
   ```

## Modifying

`MessageHandler`'s `onMessage` method is invoked when a new message comes from IG.

Edit `SystemPrompt` and `UserPrompt` to change the behaviour.
