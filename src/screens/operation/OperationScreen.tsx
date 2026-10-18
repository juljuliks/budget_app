import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { TransactionView } from '@/features/transaction-edit';
import type { RootStackParamList } from '@/shared/navigation/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Operation'>;

/** An operation's page (its title "Операция" in the stack's header); deleted or a category picked — back. */
export default function OperationScreen({ route, navigation }: Props) {
  return <TransactionView txId={route.params.id} onClose={() => { if (navigation.canGoBack()) navigation.goBack(); }} />;
}
