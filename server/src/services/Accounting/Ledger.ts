import moment from 'moment';
import { defaultTo } from 'lodash';
import {
  ILedger,
  ILedgerEntry
} from 'interfaces';
import EntityRepository from 'repositories/EntityRepository';

export default class Ledger implements ILedger {
  readonly entries: ILedgerEntry[];

  /**
   * Constructor method.
   * @param {ILedgerEntry[]} entries 
   */
  constructor(entries: ILedgerEntry[]) {
    this.entries = entries;
  }

  /**
   * Filters the ledegr entries.
   * @param callback
   * @returns
   */
  filter(callback) {
    const entries = this.entries.filter(callback);
    return new Ledger(entries);
  }

  getEntries(): ILedgerEntry[] {
    return this.entries;
  }

  whereContactId(contactId: number): ILedger {
    return this.filter((entry) => entry.contactId === contactId);
  }

  whereAccountId(accountId: number): ILedger {
    return this.filter((entry) => entry.accountId === accountId);
  }

  whereFromDate(fromDate: Date | string): ILedger {
    const fromDateParsed = moment(fromDate);

    return this.filter(
      (entry) =>
        fromDateParsed.isBefore(entry.date) || fromDateParsed.isSame(entry.date)
    );
  }

  whereToDate(toDate: Date | string): ILedger {
    const toDateParsed = moment(toDate);

    return this.filter(
      (entry) =>
        toDateParsed.isAfter(entry.date) || toDateParsed.isSame(entry.date)
    );
  }

  /**
   * Retrieve the closing balance of the entries.
   * @returns {number} 
   */
  getClosingBalance() {
    let closingBalance = 0;

    this.entries.forEach((entry) => {
      if (entry.accountNormal === 'credit') {
        closingBalance += entry.credit - entry.debit;

      } else if (entry.accountNormal === 'debit') {
        closingBalance += entry.debit - entry.credit;
      }
    });
    return closingBalance;
  }

  static mappingTransactions(entries): ILedgerEntry[] {
    return entries.map(this.mapTransaction);
  }
  
  static mapTransaction(entry): ILedgerEntry {
    return {
      credit: defaultTo(entry.credit, 0),
      debit: defaultTo(entry.debit, 0),
      accountNormal: entry.accountNormal,
      accountId: entry.accountId,
      contactId: entry.contactId,
      date: entry.date,
      transactionNumber: entry.transactionNumber,
      transactionType: entry.referenceTypeFormatted,
      referenceNumber: entry.referenceNumber,
      referenceType: entry.referenceType,
    }
  }

  static fromTransactions(transactions) {
    const entries = Ledger.mappingTransactions(transactions);
    return new Ledger(entries);
  }
}
