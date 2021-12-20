import React from 'react';
import { Tab } from '@blueprintjs/core';
import intl from 'react-intl-universal';
import { DrawerMainTabs } from 'components';

import CreditNoteDetailPanel from './CreditNoteDetailPanel';
import RefundCreditNoteTransactionsTable from './RefundCreditNoteTransactions/RefundCreditNoteTransactionsTable';
import ReconcileCreditNoteTransactionsTable from './ReconcileCreditNoteTransactions/ReconcileCreditNoteTransactionsTable';
import JournalEntriesTransactionsTable from './JournalEntriesTransactions/JournalEntriesTransactionsTable';
import clsx from 'classnames';

import CreditNoteDetailCls from '../../../style/components/Drawers/CreditNoteDetails.module.scss';

/**
 * Credit Note view detail.
 */
export default function CreditNoteDetail() {
  return (
    <div className={clsx(CreditNoteDetailCls.root)}>
      <DrawerMainTabs renderActiveTabPanelOnly={true}>
        <Tab
          title={intl.get('details')}
          id={'details'}
          panel={<CreditNoteDetailPanel />}
        />
        <Tab
          title={intl.get('journal_entries')}
          id={'journal_entries'}
          panel={<JournalEntriesTransactionsTable />}
        />
        <Tab
          title={intl.get('credit_note.drawer.label_refund_transactions')}
          id={'refund_transactions'}
          panel={<RefundCreditNoteTransactionsTable />}
        />
        <Tab
          title={intl.get('credit_note.drawer.label_invoices_reconciled')}
          id={'reconcile_transactions'}
          panel={<ReconcileCreditNoteTransactionsTable />}
        />
      </DrawerMainTabs>
    </div>
  );
}
