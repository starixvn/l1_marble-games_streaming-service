export const appConfigs = {
  hostingPort: 5000,
  database: {
    url: "mongodb://marble_backend:MarbleBackend@10.10.50.12:39400,10.10.50.13:39400,10.10.50.14:39400/?replicaSet=SPLocal0",
    options: {
      dbName: "marble_odds_feed",
    },
  },
  sentry: {
    sentryUrl: "https://6b0f71afab190ba976d8bdc7a43969fe@sentry-k8s.lumigame.com/15",
    logIdentifier: "Streaming-Service",
    env: "LOCAL",
  },
  jwt: {
    username: "marble-tv",
    password: "marble-tv-123",
    secret: "stream-service-secret",
  },
  oddsFeedAPI: {
    url: "https://mg-odds-feed-local.lumigame.com",
    operatorId: "67d291d943a96fad7f14ddae",
    password: "Nkb3rnoLMEhxUBB8Qahfn",
  },
};
