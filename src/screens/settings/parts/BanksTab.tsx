import React from 'react';
import { useRootNavigation } from '@/shared/navigation/navigation';
import { startSmsImport } from '@/features/sms-import';
import Row from './Row';

/** «Банки»: which banks are read, the message templates, importing the past SMS. */
export default function BanksTab() {
  const navigation = useRootNavigation();
  return (
    <>
      <Row label="Банки" onPress={() => navigation.navigate('Banks')} />
      <Row label="Шаблоны сообщений" onPress={() => navigation.navigate('MessageTemplates')} />
      <Row label="Импорт SMS из телефона" onPress={startSmsImport} />
    </>
  );
}
