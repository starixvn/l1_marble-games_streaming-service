const env = process.env.NODE_ENV;

const prodLog = () => {};
const devLog = (message: string) => {
  console.log(message);
};

export const log = env === "development" ? devLog : prodLog;
