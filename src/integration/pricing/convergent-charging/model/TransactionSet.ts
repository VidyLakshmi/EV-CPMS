import { CCTransaction } from './CCTransaction';

export class TransactionSet {
  public ccTransactions: CCTransaction[];

  constructor(model) {
    if (Array.isArray(model)) {
      this.ccTransactions = model.map((cctrModel) => new CCTransaction(cctrModel.master));
    } else {
      this.ccTransactions = [new CCTransaction(model.master)];
    }
  }

  getTotalUnroundedAmount(): number {
    return this.ccTransactions.map((t) => {
      return parseFloat(t.details['default.unrounded_amount']);
    })
      .reduce((previousValue, currentValue) => {
        return previousValue + currentValue;
      }, 0);
  }

  getCurrencyCode(): string {
    return this.ccTransactions[0].details['default.iso_currency_code'];
  }
}
