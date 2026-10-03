import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import TransactionsList from './TransactionsList';

type Props = NativeStackScreenProps<RootStackParamList, 'CategoryDelete'>;

/**
 * Deleting a category: the transactions list locked to its transactions of this month, in multi-select.
 * They are moved to other categories (any mix), and once none are left the category can be deleted;
 * past months keep it so history doesn't change.
 */
export default function CategoryDelete({ route }: Props) {
  return <TransactionsList deleteCategoryId={route.params.categoryId} />;
}
