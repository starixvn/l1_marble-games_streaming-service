export const appConfigs = {
  hostingPort: 5000,
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
    operatorId: "6891a166944b61adc2694d72",
    password: "Ga1kx2LmADHlepAoQiHSV",
  },
};
