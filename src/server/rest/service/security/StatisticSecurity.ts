import sanitize from 'mongo-sanitize';
import HttpStatisticsRequest from '../../../../types/requests/HttpStatisticRequest';
import Utils from '../../../../utils/Utils';

export default class StatisticSecurity {
  // eslint-disable-next-line no-unused-vars
  static filterStatisticsRequest(request: any): HttpStatisticsRequest {
    return {
      Year: Utils.convertToInt(sanitize(request.Year)),
      DateFrom: request.DateFrom ? sanitize(request.DateFrom) : null,
      DateUntil: request.DateUntil ? sanitize(request.DateUntil) : null,
      SiteAreaIDs: request.SiteAreaID ? sanitize(request.SiteAreaID).split('|') : null,
      ChargeBoxIDs: request.ChargeBoxID ? sanitize(request.ChargeBoxID).split('|') : null,
      UserIDs: request.UserID ? sanitize(request.UserID).split('|') : null,
      SiteIDs: request.SiteID ? sanitize(request.SiteID).split('|') : null
    };
  }

  // eslint-disable-next-line no-unused-vars
  static filterMetricsStatisticsRequest(request: any): HttpStatisticsRequest {
    if (!request.PeriodInMonth) {
    }
    return { PeriodInMonth: sanitize(request.PeriodInMonth) };
  }

  // eslint-disable-next-line no-unused-vars
  static filterExportStatisticsRequest(request: any): HttpStatisticsRequest {
    return { ...StatisticSecurity.filterStatisticsRequest(request),
      DataType: sanitize(request.DataType),
      DataCategory: sanitize(request.DataCategory),
      DataScope: sanitize(request.DataScope)
    };
  }
}
