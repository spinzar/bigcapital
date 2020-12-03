import { connect } from 'react-redux';
import { getResourceViews } from 'store/customViews/customViews.selectors';
import {
  getPaymentReceiveCurrentPageFactory,
  getPaymentReceivePaginationMetaFactory,
  getPaymentReceiveTableQuery,
  getPaymentReceivesCurrentViewIdFactory,
} from 'store/PaymentReceive/paymentReceive.selector';

export default (mapState) => {
  const getPyamentReceivesItems = getPaymentReceiveCurrentPageFactory();
  const getPyamentReceivesPaginationMeta = getPaymentReceivePaginationMetaFactory();
  const getPaymentReceivesCurrentViewId = getPaymentReceivesCurrentViewIdFactory();

  const mapStateToProps = (state, props) => {
    const query = getPaymentReceiveTableQuery(state, props);
    const mapped = {
      PaymentReceivesCurrentPage: getPyamentReceivesItems(state, props, query),
      paymentReceivesViews: getResourceViews(state, props, 'payment_receives'),
      paymentReceivesItems: state.paymentReceives.items,
      paymentReceivesTableQuery: query,
      paymentReceivesPageination: getPyamentReceivesPaginationMeta(
        state,
        props,
        query,
      ),
      paymentReceivesLoading: state.paymentReceives.loading,
      paymentReceiveNumberChanged: state.paymentReceives.journalNumberChanged,
      paymentReceivesCurrentViewId: getPaymentReceivesCurrentViewId(state, props),
    };
    return mapState ? mapState(mapped, state, props) : mapped;
  };
  return connect(mapStateToProps);
};