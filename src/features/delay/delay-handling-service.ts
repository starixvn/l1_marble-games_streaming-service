import { OddsFeedEventName, Event } from "odds-feed-client";

export type DelayConfig = {
  globalDelayInMillisecond?: number;
  videoDelayInMillisecond?: number;
  eventScheduleStartDelayInMillisecond?: number;
  eventDetailScheduleStartDelayInMillisecond?: number;
  eventDetailResultAvailableDelayInMillisecond?: number;
};

interface DelayOptions {
  oddsFeedEventType?: OddsFeedEventName;
}
export class DelayHandlingService {
  public getDelayedTime({ event, time }: { event: Event; time: Date }, { oddsFeedEventType }: DelayOptions = {}): Date {
    const config = (event as any).config?.delay as DelayConfig;
    if (!config) {
      return time;
    }
    return this.getDelayedTimeByConfig({ config, time }, { oddsFeedEventType });
  }

  public getDelayedTimeWithVideoDelay(
    { event, time }: { event: Event; time: Date },
    { oddsFeedEventType }: DelayOptions = {}
  ): Date {
    const config = (event as any).config?.delay as DelayConfig;
    if (!config) {
      return time;
    }
    return this.getDelayedTimeWithVideoDelayByConfig({ config, time }, { oddsFeedEventType });
  }

  private getDelayedTimeWithVideoDelayByConfig(
    { config, time }: { config: DelayConfig; time: Date },
    { oddsFeedEventType }: DelayOptions = {}
  ): Date {
    const videoDelayInMillisecond = config.videoDelayInMillisecond ?? 0;
    return new Date(
      this.getDelayedTimeByConfig({ config, time }, { oddsFeedEventType }).getTime() + videoDelayInMillisecond
    );
  }

  private getDelayedTimeByConfig(
    { config, time }: { config: DelayConfig; time: Date },
    { oddsFeedEventType }: DelayOptions = {}
  ): Date {
    const globalDelayInMillisecond = config.globalDelayInMillisecond ?? 0;
    const eventTypeDelayMilliseconds = this.getDelayConfigByEventTypeFromConfig({
      config,
      oddsFeedEventType,
    });
    return new Date(time.getTime() + globalDelayInMillisecond + eventTypeDelayMilliseconds);
  }

  private getDelayConfigByEventTypeFromConfig({
    config,
    oddsFeedEventType,
  }: {
    config: DelayConfig;
    oddsFeedEventType?: OddsFeedEventName;
  }): number {
    if (!oddsFeedEventType) {
      return 0;
    }

    switch (oddsFeedEventType) {
      case OddsFeedEventName.EventStart:
        return config.eventScheduleStartDelayInMillisecond ?? 0;
      case OddsFeedEventName.EventDetailStart:
        return config.eventDetailScheduleStartDelayInMillisecond ?? 0;
      case OddsFeedEventName.EventDetailResultsAvailable:
        return config.eventDetailResultAvailableDelayInMillisecond ?? 0;
      default:
        return 0;
    }
  }
}
