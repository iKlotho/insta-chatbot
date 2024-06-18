import ChatBot from "./src/chatbot";

(async () => {
  const chatBot = await ChatBot.create();
  await chatBot.start();
})();
