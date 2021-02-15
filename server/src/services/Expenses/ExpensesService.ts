import { Service, Inject } from 'typedi';
import { difference, sumBy, omit, map } from 'lodash';
import moment from 'moment';
import {
  EventDispatcher,
  EventDispatcherInterface,
} from 'decorators/eventDispatcher';
import { ServiceError } from 'exceptions';
import TenancyService from 'services/Tenancy/TenancyService';
import JournalPoster from 'services/Accounting/JournalPoster';
import JournalCommands from 'services/Accounting/JournalCommands';
import {
  IExpense,
  IExpensesFilter,
  IAccount,
  IExpenseDTO,
  IExpensesService,
  ISystemUser,
  IPaginationMeta,
} from 'interfaces';
import DynamicListingService from 'services/DynamicListing/DynamicListService';
import events from 'subscribers/events';
import ContactsService from 'services/Contacts/ContactsService';
import { ACCOUNT_PARENT_TYPE, ACCOUNT_ROOT_TYPE } from 'data/AccountTypes'

const ERRORS = {
  EXPENSE_NOT_FOUND: 'expense_not_found',
  EXPENSES_NOT_FOUND: 'EXPENSES_NOT_FOUND',
  PAYMENT_ACCOUNT_NOT_FOUND: 'payment_account_not_found',
  SOME_ACCOUNTS_NOT_FOUND: 'some_expenses_not_found',
  TOTAL_AMOUNT_EQUALS_ZERO: 'total_amount_equals_zero',
  PAYMENT_ACCOUNT_HAS_INVALID_TYPE: 'payment_account_has_invalid_type',
  EXPENSES_ACCOUNT_HAS_INVALID_TYPE: 'expenses_account_has_invalid_type',
  EXPENSE_ALREADY_PUBLISHED: 'expense_already_published',
};

@Service()
export default class ExpensesService implements IExpensesService {
  @Inject()
  tenancy: TenancyService;

  @Inject()
  dynamicListService: DynamicListingService;

  @Inject('logger')
  logger: any;

  @EventDispatcher()
  eventDispatcher: EventDispatcherInterface;

  @Inject()
  contactsService: ContactsService;

  /**
   * Retrieve the payment account details or returns not found server error in case the
   * given account not found on the storage.
   * @param   {number} tenantId
   * @param   {number} paymentAccountId
   * @returns {Promise<IAccount>}
   */
  private async getPaymentAccountOrThrowError(
    tenantId: number,
    paymentAccountId: number
  ) {
    this.logger.info('[expenses] trying to get the given payment account.', {
      tenantId,
      paymentAccountId,
    });

    const { accountRepository } = this.tenancy.repositories(tenantId);
    const paymentAccount = await accountRepository.findOneById(
      paymentAccountId
    );

    if (!paymentAccount) {
      this.logger.info('[expenses] the given payment account not found.', {
        tenantId,
        paymentAccountId,
      });
      throw new ServiceError(ERRORS.PAYMENT_ACCOUNT_NOT_FOUND);
    }
    return paymentAccount;
  }

  /**
   * Retrieve expense accounts or throw error in case one of the given accounts
   * not found not the storage.
   * @param   {number} tenantId
   * @param   {number} expenseAccountsIds
   * @throws  {ServiceError}
   * @returns {Promise<IAccount[]>}
   */
  private async getExpensesAccountsOrThrowError(
    tenantId: number,
    expenseAccountsIds: number[]
  ) {
    this.logger.info('[expenses] trying to get expenses accounts.', {
      tenantId,
      expenseAccountsIds,
    });

    const { accountRepository } = this.tenancy.repositories(tenantId);
    const storedExpenseAccounts = await accountRepository.findWhereIn(
      'id',
      expenseAccountsIds
    );
    const storedExpenseAccountsIds = storedExpenseAccounts.map(
      (a: IAccount) => a.id
    );
    const notStoredAccountsIds = difference(
      expenseAccountsIds,
      storedExpenseAccountsIds
    );
    if (notStoredAccountsIds.length > 0) {
      this.logger.info('[expenses] some of expense accounts not found.', {
        tenantId,
        expenseAccountsIds,
      });
      throw new ServiceError(ERRORS.SOME_ACCOUNTS_NOT_FOUND);
    }
    return storedExpenseAccounts;
  }

  /**
   * Validates expense categories not equals zero.
   * @param  {IExpenseDTO|ServiceError} expenseDTO
   * @throws {ServiceError}
   */
  private validateCategoriesNotEqualZero(expenseDTO: IExpenseDTO) {
    this.logger.info(
      '[expenses] validate the expenses categoires not equal zero.',
      { expenseDTO }
    );
    const totalAmount = sumBy(expenseDTO.categories, 'amount') || 0;

    if (totalAmount <= 0) {
      this.logger.info('[expenses] the given expense categories equal zero.', {
        expenseDTO,
      });
      throw new ServiceError(ERRORS.TOTAL_AMOUNT_EQUALS_ZERO);
    }
  }

  /**
   * Validate expenses accounts type.
   * @param {number} tenantId
   * @param {number[]} expensesAccountsIds
   */
  private async validateExpensesAccountsType(
    tenantId: number,
    expensesAccounts: number[]
  ) {
    this.logger.info('[expenses] trying to validate expenses accounts type.', {
      tenantId,
      expensesAccounts,
    });
    const invalidExpenseAccounts: number[] = [];

    expensesAccounts.forEach((expenseAccount) => {
      if (!expenseAccount.isRootType(ACCOUNT_ROOT_TYPE.EXPENSE)) {
        invalidExpenseAccounts.push(expenseAccount.id);
      }
    });
    if (invalidExpenseAccounts.length > 0) {
      throw new ServiceError(ERRORS.EXPENSES_ACCOUNT_HAS_INVALID_TYPE);
    }
  }

  /**
   * Validates payment account type in case has invalid type throws errors.
   * @param  {number} tenantId
   * @param  {number} paymentAccountId
   * @throws {ServiceError}
   */
  private async validatePaymentAccountType(
    tenantId: number,
    paymentAccount: number[]
  ) {
    this.logger.info('[expenses] trying to validate payment account type.', {
      tenantId,
      paymentAccount,
    });

    if (!paymentAccount.isParentType(ACCOUNT_PARENT_TYPE.CURRENT_ASSET)) {
      this.logger.info(
        '[expenses] the given payment account has invalid type',
        { tenantId, paymentAccount }
      );
      throw new ServiceError(ERRORS.PAYMENT_ACCOUNT_HAS_INVALID_TYPE);
    }
  }

  /**
   * Reverts expense journal entries.
   * @param {number} tenantId
   * @param {number} expenseId
   */
  public async revertJournalEntries(
    tenantId: number,
    expenseId: number | number[]
  ): Promise<void> {
    const journal = new JournalPoster(tenantId);
    const journalCommands = new JournalCommands(journal);

    await journalCommands.revertJournalEntries(expenseId, 'Expense');

    await Promise.all([journal.saveBalance(), journal.deleteEntries()]);
  }

  /**
   * Writes expense journal entries.
   * @param {number} tenantId
   * @param {IExpense} expense
   * @param {IUser} authorizedUser
   */
  public async writeJournalEntries(
    tenantId: number,
    expense: IExpense | IExpense[],
    authorizedUserId: number,
    override: boolean = false
  ): Promise<void> {
    this.logger.info('[expense] trying to write expense journal entries.', {
      tenantId,
      expense,
    });
    const journal = new JournalPoster(tenantId);
    const journalCommands = new JournalCommands(journal);

    const expenses = Array.isArray(expense) ? expense : [expense];
    const expensesIds = expenses.map((expense) => expense.id);

    if (override) {
      await journalCommands.revertJournalEntries(expensesIds, 'Expense');
    }
    expenses.forEach((expense: IExpense) => {
      journalCommands.expense(expense, authorizedUserId);
    });
    await Promise.all([
      journal.saveBalance(),
      journal.saveEntries(),
      journal.deleteEntries(),
    ]);
  }

  /**
   * Retrieve the given expenses or throw not found error.
   * @param   {number} tenantId
   * @param   {number} expenseId
   * @returns {IExpense|ServiceError}
   */
  private async getExpenseOrThrowError(tenantId: number, expenseId: number) {
    const { expenseRepository } = this.tenancy.repositories(tenantId);

    this.logger.info('[expense] trying to get the given expense.', {
      tenantId,
      expenseId,
    });
    // Retrieve the given expense by id.
    const expense = await expenseRepository.findOneById(expenseId);

    if (!expense) {
      this.logger.info('[expense] the given expense not found.', {
        tenantId,
        expenseId,
      });
      throw new ServiceError(ERRORS.EXPENSE_NOT_FOUND);
    }
    return expense;
  }

  /**
   * Retrieve the give expenses models or throw not found service error.
   * @param {number} tenantId -
   * @param {number[]} expensesIds -
   */
  async getExpensesOrThrowError(
    tenantId: number,
    expensesIds: number[]
  ): Promise<IExpense[]> {
    const { expenseRepository } = this.tenancy.repositories(tenantId);

    const storedExpenses = await expenseRepository.findWhereIn(
      'id',
      expensesIds,
      'categories'
    );
    const storedExpensesIds = storedExpenses.map((expense) => expense.id);
    const notFoundExpenses = difference(expensesIds, storedExpensesIds);

    // In case there is not found expenses throw service error.
    if (notFoundExpenses.length > 0) {
      this.logger.info('[expense] the give expenses ids not found.', {
        tenantId,
        expensesIds,
      });
      throw new ServiceError(ERRORS.EXPENSES_NOT_FOUND);
    }
    return storedExpenses;
  }

  /**
   * Validates expenses is not already published before.
   * @param {IExpense} expense
   */
  private validateExpenseIsNotPublished(expense: IExpense) {
    if (expense.publishedAt) {
      throw new ServiceError(ERRORS.EXPENSE_ALREADY_PUBLISHED);
    }
  }

  /**
   * Mapping expense DTO to model.
   * @param  {IExpenseDTO} expenseDTO
   * @param  {ISystemUser} authorizedUser
   * @return {IExpense}
   */
  private expenseDTOToModel(expenseDTO: IExpenseDTO, user?: ISystemUser) {
    const totalAmount = sumBy(expenseDTO.categories, 'amount');

    return {
      categories: [],
      ...omit(expenseDTO, ['publish']),
      totalAmount,
      paymentDate: moment(expenseDTO.paymentDate).toMySqlDateTime(),
      ...(user
        ? {
            userId: user.id,
          }
        : {}),
      ...(expenseDTO.publish
        ? {
            publishedAt: moment().toMySqlDateTime(),
          }
        : {}),
    };
  }

  /**
   * Mapping the expenses accounts ids from expense DTO.
   * @param  {IExpenseDTO} expenseDTO
   * @return {number[]}
   */
  mapExpensesAccountsIdsFromDTO(expenseDTO: IExpenseDTO) {
    return expenseDTO.categories.map((category) => category.expenseAccountId);
  }

  /**
   * Precedures.
   * ---------
   * 1. Validate payment account existance on the storage.
   * 2. Validate expense accounts exist on the storage.
   * 3. Validate payment account type.
   * 4. Validate expenses accounts type.
   * 5. Validate the expense payee contact id existance on storage.
   * 6. Validate the given expense categories not equal zero.
   * 7. Stores the expense to the storage.
   * ---------
   * @param {number} tenantId
   * @param {IExpenseDTO} expenseDTO
   */
  public async newExpense(
    tenantId: number,
    expenseDTO: IExpenseDTO,
    authorizedUser: ISystemUser
  ): Promise<IExpense> {
    const { expenseRepository } = this.tenancy.repositories(tenantId);

    // Validate payment account existance on the storage.
    const paymentAccount = await this.getPaymentAccountOrThrowError(
      tenantId,
      expenseDTO.paymentAccountId
    );
    // Validate expense accounts exist on the storage.
    const expensesAccounts = await this.getExpensesAccountsOrThrowError(
      tenantId,
      this.mapExpensesAccountsIdsFromDTO(expenseDTO)
    );
    // Validate payment account type.
    await this.validatePaymentAccountType(tenantId, paymentAccount);

    // Validate expenses accounts type.
    await this.validateExpensesAccountsType(tenantId, expensesAccounts);

    // Validate the expense payee contact id existance on storage.
    if (expenseDTO.payeeId) {
      await this.contactsService.getContactByIdOrThrowError(
        tenantId,
        expenseDTO.payeeId
      );
    }
    // Validate the given expense categories not equal zero.
    this.validateCategoriesNotEqualZero(expenseDTO);

    // Save the expense to the storage.
    const expenseObj = this.expenseDTOToModel(expenseDTO, authorizedUser);
    const expense = await expenseRepository.upsertGraph(expenseObj);

    this.logger.info(
      '[expense] the expense stored to the storage successfully.',
      { tenantId, expenseDTO }
    );
    // Triggers `onExpenseCreated` event.
    this.eventDispatcher.dispatch(events.expenses.onCreated, {
      tenantId,
      expenseId: expense.id,
      authorizedUser,
      expense,
    });
    return expense;
  }

  /**
   * Precedures.
   * ---------
   * 1. Validate expense existance.
   * 2. Validate payment account existance on the storage.
   * 3. Validate expense accounts exist on the storage.
   * 4. Validate payment account type.
   * 5. Validate expenses accounts type.
   * 6. Validate the given expense categories not equal zero.
   * 7. Stores the expense to the storage.
   * ---------
   * @param {number} tenantId
   * @param {number} expenseId
   * @param {IExpenseDTO} expenseDTO
   * @param {ISystemUser} authorizedUser
   */
  public async editExpense(
    tenantId: number,
    expenseId: number,
    expenseDTO: IExpenseDTO,
    authorizedUser: ISystemUser
  ): Promise<IExpense> {
    const { expenseRepository } = this.tenancy.repositories(tenantId);
    const oldExpense = await this.getExpenseOrThrowError(tenantId, expenseId);

    // - Validate payment account existance on the storage.
    const paymentAccount = await this.getPaymentAccountOrThrowError(
      tenantId,
      expenseDTO.paymentAccountId
    );
    // - Validate expense accounts exist on the storage.
    const expensesAccounts = await this.getExpensesAccountsOrThrowError(
      tenantId,
      this.mapExpensesAccountsIdsFromDTO(expenseDTO)
    );
    // - Validate payment account type.
    await this.validatePaymentAccountType(tenantId, paymentAccount);

    // - Validate expenses accounts type.
    await this.validateExpensesAccountsType(tenantId, expensesAccounts);

    // - Validate the expense payee contact id existance on storage.
    if (expenseDTO.payeeId) {
      await this.contactsService.getContactByIdOrThrowError(
        tenantId,
        expenseDTO.payeeId
      );
    }
    // - Validate the given expense categories not equal zero.
    this.validateCategoriesNotEqualZero(expenseDTO);

    // - Update the expense on the storage.
    const expenseObj = this.expenseDTOToModel(expenseDTO);

    // - Upsert the expense object with expense entries.
    const expense = await expenseRepository.upsertGraph({
      id: expenseId,
      ...expenseObj,
    });

    this.logger.info(
      '[expense] the expense updated on the storage successfully.',
      { tenantId, expenseId }
    );
    // Triggers `onExpenseCreated` event.
    this.eventDispatcher.dispatch(events.expenses.onEdited, {
      tenantId,
      expenseId,
      expense,
      expenseDTO,
      authorizedUser,
      oldExpense,
    });
    return expense;
  }

  /**
   * Publish the given expense.
   * @param {number} tenantId
   * @param {number} expenseId
   * @param {ISystemUser} authorizedUser
   * @return {Promise<void>}
   */
  public async publishExpense(
    tenantId: number,
    expenseId: number,
    authorizedUser: ISystemUser
  ) {
    const { expenseRepository } = this.tenancy.repositories(tenantId);
    const oldExpense = await this.getExpenseOrThrowError(tenantId, expenseId);

    if (oldExpense instanceof ServiceError) {
      throw oldExpense;
    }
    this.validateExpenseIsNotPublished(oldExpense);

    this.logger.info('[expense] trying to publish the expense.', {
      tenantId,
      expenseId,
    });
    // Publish the given expense on the storage.
    await expenseRepository.publish(expenseId);

    // Retrieve the new expense after modification.
    const expense = await expenseRepository.findOneById(
      expenseId,
      'categories'
    );

    this.logger.info('[expense] the expense published successfully.', {
      tenantId,
      expenseId,
    });
    // Triggers `onExpensePublished` event.
    this.eventDispatcher.dispatch(events.expenses.onPublished, {
      tenantId,
      expenseId,
      oldExpense,
      expense,
      authorizedUser,
    });
  }

  /**
   * Deletes the given expense.
   * @param {number} tenantId
   * @param {number} expenseId
   * @param {ISystemUser} authorizedUser
   */
  public async deleteExpense(
    tenantId: number,
    expenseId: number,
    authorizedUser: ISystemUser
  ): Promise<void> {
    const oldExpense = await this.getExpenseOrThrowError(tenantId, expenseId);
    const {
      expenseRepository,
      expenseEntryRepository,
    } = this.tenancy.repositories(tenantId);

    this.logger.info('[expense] trying to delete the expense.', {
      tenantId,
      expenseId,
    });
    await expenseEntryRepository.deleteBy({ expenseId });
    await expenseRepository.deleteById(expenseId);

    this.logger.info('[expense] the expense deleted successfully.', {
      tenantId,
      expenseId,
    });

    // Triggers `onExpenseDeleted` event.
    this.eventDispatcher.dispatch(events.expenses.onDeleted, {
      tenantId,
      expenseId,
      authorizedUser,
      oldExpense,
    });
  }

  /**
   * Deletes the given expenses in bulk.
   * @param {number} tenantId
   * @param {number[]} expensesIds
   * @param {ISystemUser} authorizedUser
   */
  public async deleteBulkExpenses(
    tenantId: number,
    expensesIds: number[],
    authorizedUser: ISystemUser
  ) {
    const {
      expenseRepository,
      expenseEntryRepository,
    } = this.tenancy.repositories(tenantId);

    // Retrieve olds expenses.
    const oldExpenses = await this.getExpensesOrThrowError(
      tenantId,
      expensesIds
    );

    this.logger.info('[expense] trying to delete the given expenses.', {
      tenantId,
      expensesIds,
    });
    await expenseEntryRepository.deleteWhereIn('expenseId', expensesIds);
    await expenseRepository.deleteWhereIdIn(expensesIds);

    this.logger.info('[expense] the given expenses deleted successfully.', {
      tenantId,
      expensesIds,
    });
    // Triggers `onExpenseBulkDeleted` event.
    this.eventDispatcher.dispatch(events.expenses.onBulkDeleted, {
      tenantId,
      expensesIds,
      oldExpenses,
      authorizedUser,
    });
  }

  /**
   * Filters the not published expenses.
   * @param {IExpense[]} expenses - 
   */
  public getNonePublishedExpenses(expenses: IExpense[]): IExpense[] {
    return expenses.filter((expense) => !expense.publishedAt);
  }

  /**
   * Filtesr the published expenses.
   * @param {IExpense[]} expenses -
   * @return {IExpense[]}
   */
  public getPublishedExpenses(expenses: IExpense[]): IExpense[] {
    return expenses.filter((expense) => expense.publishedAt);
  }

  /**
   * Deletes the given expenses in bulk.
   * @param {number} tenantId
   * @param {number[]} expensesIds
   * @param {ISystemUser} authorizedUser
   */
  public async publishBulkExpenses(
    tenantId: number,
    expensesIds: number[],
    authorizedUser: ISystemUser
  ): Promise<{
    meta: {
      alreadyPublished: number;
      published: number;
      total: number,
    },
  }> {
    const oldExpenses = await this.getExpensesOrThrowError(
      tenantId,
      expensesIds
    );
    const { expenseRepository } = this.tenancy.repositories(tenantId);

    // Filters the not published expenses.
    const notPublishedExpenses = this.getNonePublishedExpenses(oldExpenses);

    // Filters the published expenses.
    const publishedExpenses = this.getPublishedExpenses(oldExpenses);

    // Mappes the not-published expenses to get id.
    const notPublishedExpensesIds = map(notPublishedExpenses, 'id');

    if (notPublishedExpensesIds.length > 0) {
      this.logger.info('[expense] trying to publish the given expenses.', {
        tenantId,
        expensesIds,
      });
      await expenseRepository.whereIdInPublish(notPublishedExpensesIds);

      this.logger.info(
        '[expense] the given expenses ids published successfully.',
        { tenantId, expensesIds }
      );
    }
    // Retrieve the new expenses after modification.
    const expenses = await expenseRepository.findWhereIn(
      'id',
      expensesIds,
      'categories'
    );
    // Triggers `onExpenseBulkDeleted` event.
    this.eventDispatcher.dispatch(events.expenses.onBulkPublished, {
      tenantId,
      expensesIds,
      oldExpenses,
      expenses,
      authorizedUser,
    });

    return {
      meta: {
        alreadyPublished: publishedExpenses.length,
        published: notPublishedExpenses.length,
        total: oldExpenses.length,
      },
    };
  }

  /**
   * Retrieve expenses datatable lsit.
   * @param  {number} tenantId
   * @param  {IExpensesFilter} expensesFilter
   * @return {IExpense[]}
   */
  public async getExpensesList(
    tenantId: number,
    expensesFilter: IExpensesFilter
  ): Promise<{
    expenses: IExpense[];
    pagination: IPaginationMeta;
    filterMeta: IFilterMeta;
  }> {
    const { Expense } = this.tenancy.models(tenantId);
    const dynamicFilter = await this.dynamicListService.dynamicList(
      tenantId,
      Expense,
      expensesFilter
    );

    this.logger.info('[expense] trying to get expenses datatable list.', {
      tenantId,
      expensesFilter,
    });
    const { results, pagination } = await Expense.query()
      .onBuild((builder) => {
        builder.withGraphFetched('paymentAccount');
        builder.withGraphFetched('categories.expenseAccount');
        dynamicFilter.buildQuery()(builder);
      })
      .pagination(expensesFilter.page - 1, expensesFilter.pageSize);

    return {
      expenses: results,
      pagination,
      filterMeta: dynamicFilter.getResponseMeta(),
    };
  }

  /**
   * Retrieve expense details.
   * @param {number} tenantId
   * @param {number} expenseId
   * @return {Promise<IExpense>}
   */
  public async getExpense(
    tenantId: number,
    expenseId: number
  ): Promise<IExpense> {
    const { expenseRepository } = this.tenancy.repositories(tenantId);

    const expense = await expenseRepository.findOneById(expenseId, [
      'paymentAccount',
      'categories',
    ]);
    if (!expense) {
      throw new ServiceError(ERRORS.EXPENSE_NOT_FOUND);
    }
    return expense;
  }
}
