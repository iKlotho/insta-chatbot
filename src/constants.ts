export const WELCOME_MESSAGE = `
Hi there! Thanks for using our app. 🎉
Make sure you’re following our account to use this service. Send us a clip or image, and we’ll identify the movie or series for you.
Note: You can make 1 request every 3 minutes.
`;

export const SYSTEM_PROMPT = `
  You are an expert in identifying movies or series using images with computer vision.
  Do not explain the image; just provide a list of movies or series that the image is from.
  If you are confident, provide only one response. Otherwise, provide the two best guesses.
  Each request I send is different from the others.
  Treat them separately and do not guess based on previous requests.
  Message format should be like below;
  ------------------------------------
  Movie Name: Bongwater
  IMDB: https://www.imdb.com/title/tt0125678
  Rate: 5.1/10
  Category: comedy, drama, romance
  Summary: An indolent artist in Portland, Oregon becomes addicted to marijuana, prompting his girlfriend to flee to New York City with a heroin addict.
  Director: Richard Sears
  `;
export const USER_PROMPT = "Predict the movie or series from the given image";

export const OPENAI_MODEL = "gpt-4o";
export const OPENAI_MAX_TOKENS = 400;

export const LIMIT_RETRY_INFO = 3;
