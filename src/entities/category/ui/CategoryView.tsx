import React from 'react';
import { StyleSheet } from 'react-native';
import { SheetActions } from '@/shared/ui/Button';
import Loading from '@/shared/ui/Loading';
import Page from '@/shared/ui/Page';
import { useCategoryForm } from '../model/useCategoryForm';
import CategoryFields from './CategoryFields';
import CategorySummaryRow from './CategorySummaryRow';

type Props = {
  categoryId: number;
  /** leaves the page: the category saved */
  onClose: () => void;
  /** "N операций · X ₾ ›" and "Показать все ›": the operations of it */
  onShowOperations: () => void;
  /** «Удалить категорию» (not a system one): the screen runs the deletion (a feature) */
  onDelete?: () => void;
  /** under "N операций ›": the pages about it («Динамика трат») */
  links?: React.ReactNode;
  /** under its fields: what a feature adds to the page ("Подписки") */
  extra?: React.ReactNode;
  /** its latest operations (the page passes them: an operations entity) */
  recent?: React.ReactNode;
};

/**
 * A category's page: its operations (a link to them), its dynamics, section, emoji and name, color, "Подписки", its latest operations;
 * "Сохранить" and "Удалить категорию" pinned at the bottom.
 */
export default function CategoryView({ categoryId, onClose, onShowOperations, onDelete, links, extra, recent }: Props) {
  const f = useCategoryForm({ visible: true, categoryId, onClose });
  if (!f.summary) return <Loading />;
  const system = f.systemKind !== null;
  return (
    <Page contentStyle={styles.content} footer={(
      <SheetActions
        style={styles.actions}
        submit={{ title: 'Сохранить', onPress: f.save, disabled: f.isSubmitting || !f.isDirty }}
        extra={system || !onDelete ? undefined : [{ title: 'Удалить категорию', onPress: onDelete, danger: true }]}
      />
    )}>
      <CategorySummaryRow summary={f.summary} onShow={onShowOperations} />
      {links}
      <CategoryFields f={f} />
      {extra}
      {recent}
    </Page>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 14 },
  actions: { marginTop: 0 },
});
