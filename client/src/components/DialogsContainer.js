import React, { lazy } from 'react';

import AccountFormDialog from 'containers/Dialogs/AccountFormDialog';

// import UserFormDialog from 'containers/Dialogs/UserFormDialog';
// import ItemCategoryDialog from 'containers/Dialogs/ItemCategoryDialog';
// import CurrencyDialog from 'containers/Dialogs/CurrencyDialog';
// import InviteUserDialog from 'containers/Dialogs/InviteUserDialog';
// import ExchangeRateDialog from 'containers/Dialogs/ExchangeRateDialog';
// import JournalNumberDailog from 'containers/Dialogs/JournalNumberDailog';


export default function DialogsContainer() {
  return (
    <div>
      <AccountFormDialog dialogName={'account-form'} />
    </div>
  );
}
