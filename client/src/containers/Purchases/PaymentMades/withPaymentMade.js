import { connect } from 'react-redux';
import { getResourceViews } from 'store/customViews/customViews.selectors';
import {
  getPaymentMadeCurrentPageFactory,
  getPaymentMadePaginationMetaFactory,
  getPaymentMadeTableQuery,
  getPaymentMadeEntriesFactory,
  getPaymentMadesCurrentViewIdFactory
} from 'store/PaymentMades/paymentMade.selector';

export default (mapState) => {
  const getPyamentMadesItems = getPaymentMadeCurrentPageFactory();
  const getPyamentMadesPaginationMeta = getPaymentMadePaginationMetaFactory();
  const getPaymentMadeEntries = getPaymentMadeEntriesFactory();
  const getPaymentMadesCurrentViewId = getPaymentMadesCurrentViewIdFactory();

  const mapStateToProps = (state, props) => {
    const query = getPaymentMadeTableQuery(state, props);

    const mapped = {
      paymentMadeCurrentPage: getPyamentMadesItems(state, props, query),
      paymentMadeViews: getResourceViews(state, props, 'bill_payments'),
      paymentMadeItems: state.paymentMades.items,
      paymentMadeTableQuery: query,
      paymentMadePageination: getPyamentMadesPaginationMeta(
        state,
        props,
        query,
      ),
      paymentMadesLoading: state.paymentMades.loading,
      nextPaymentNumberChanged: state.paymentMades.nextPaymentNumberChanged,
      paymentMadeEntries: getPaymentMadeEntries(state, props),

      paymentMadesCurrentViewId: getPaymentMadesCurrentViewId(state, props),
    };
    return mapState ? mapState(mapped, state, props) : mapped;
  };
  return connect(mapStateToProps);
};