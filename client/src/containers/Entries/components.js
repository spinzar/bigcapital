import React from 'react';
import { FormattedMessage as T, useIntl } from 'react-intl';
import { Tooltip, Button, Intent, Position } from '@blueprintjs/core';
import { sumBy } from 'lodash';
import { Hint, Icon } from 'components';
import { formattedAmount } from 'utils';
import {
  InputGroupCell,
  MoneyFieldCell,
  ItemsListCell,
  PercentFieldCell,
} from 'components/DataTableCells';

/**
 * Item header cell.
 */
export function ItemHeaderCell() {
  return (
    <>
      <T id={'product_and_service'} />
      <Hint />
    </>
  );
}

/**
 * Item column footer cell.
 */
export function ItemFooterCell() {
  return <span>Total</span>;
}

/**
 * Actions cell renderer component.
 */
export function ActionsCellRenderer({
  row: { index },
  column: { id },
  cell: { value },
  data,
  payload: { removeRow },
}) {
  const onRemoveRole = () => {
    removeRow(index);
  };

  return (
    <Tooltip content={<T id={'remove_the_line'} />} position={Position.LEFT}>
      <Button
        icon={<Icon icon={'times-circle'} iconSize={14} />}
        iconSize={14}
        className="m12"
        intent={Intent.DANGER}
        onClick={onRemoveRole}
      />
    </Tooltip>
  );
}

/**
 * Quantity total footer cell.
 */
export function QuantityTotalFooterCell({ rows }) {
  const quantity = sumBy(rows, r => parseInt(r.original.quantity, 10));
  return <span>{ formattedAmount(quantity, 'USD') }</span>;
}

/**
 * Total footer cell.
 */
export function TotalFooterCell({ rows }) {
  const total = sumBy(rows, 'original.total');
  return <span>{ formattedAmount(total, 'USD') }</span>;
}

/**
 * Total accessor.
 */
export function TotalCell({ value }) {
  return <span>{ formattedAmount(value, 'USD', { noZero: true }) }</span>;
}

/**
 * Retrieve editable items entries columns.
 */
export function useEditableItemsEntriesColumns() {
  const { formatMessage } = useIntl();

  return React.useMemo(
    () => [
      {
        Header: '#',
        accessor: 'index',
        Cell: ({ row: { index } }) => <span>{index + 1}</span>,
        width: 40,
        disableResizing: true,
        disableSortBy: true,
        className: 'index',
      },
      {
        Header: ItemHeaderCell,
        id: 'item_id',
        accessor: 'item_id',
        Cell: ItemsListCell,
        Footer: ItemFooterCell,
        disableSortBy: true,
        width: 180,
        // filterPurchasable: filterPurchasableItems,
        // filterSellable: filterSellableItems,
      },
      {
        Header: formatMessage({ id: 'description' }),
        accessor: 'description',
        Cell: InputGroupCell,
        disableSortBy: true,
        className: 'description',
        width: 100,
      },
      {
        Header: formatMessage({ id: 'quantity' }),
        accessor: 'quantity',
        Cell: InputGroupCell,
        Footer: QuantityTotalFooterCell,
        disableSortBy: true,
        width: 80,
        className: 'quantity',
      },
      {
        Header: formatMessage({ id: 'rate' }),
        accessor: 'rate',
        Cell: MoneyFieldCell,
        disableSortBy: true,
        width: 80,
        className: 'rate',
      },
      {
        Header: formatMessage({ id: 'discount' }),
        accessor: 'discount',
        Cell: PercentFieldCell,
        disableSortBy: true,
        width: 80,
        className: 'discount',
      },
      {
        Header: formatMessage({ id: 'total' }),
        Footer: TotalFooterCell,
        accessor: 'total',
        Cell: TotalCell,
        disableSortBy: true,
        width: 120,
        className: 'total',
      },
      {
        Header: '',
        accessor: 'action',
        Cell: ActionsCellRenderer,
        className: 'actions',
        disableSortBy: true,
        disableResizing: true,
        width: 45,
      },
    ],
    [formatMessage],
  );
}
 