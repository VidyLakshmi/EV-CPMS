import client, { LabelValues } from 'prom-client';
import { AvgGaugeClearableMetric } from './AvgGaugeClearableMetric';
import { CountAvgGaugeClearableMetric } from './CountAvgGaugeClearableMetric';
import { CounterClearableMetric } from './CounterClearableMetric';

export default abstract class MonitoringServer {
  public abstract start(): void;

  public abstract getGauge(name: string): client.Gauge | undefined;


  public abstract getCounterClearableMetric(prefix : string, metricname: string, metricHelp: string, labelValues: LabelValues<string>) : CounterClearableMetric;

  public abstract getCountAvgClearableMetric(prefix : string, metricname: string, suffix: number, metricAvgHelp: string, metricCountHelp: string, labelNames: string[]) : CountAvgGaugeClearableMetric ;

  public abstract getAvgClearableMetric(
    prefix: string,
    metricname: string,
    suffix: number,
    metrichelp: string,
    labelNames: string[]
  ): AvgGaugeClearableMetric;
}
