import React from 'react';
import { Text, View } from 'react-native';
import SectionBand from '@/shared/ui/SectionBand';
import { styles } from './styles';

/** a report's page: its side padding, as the stats' (the sections go edge to edge) */
export const PAGE_INSET = 16;

type Props = {
  /** none — the block's head is its first line (a story's card) */
  title?: string;
  /** at the head's right: the block's total («≈ −3 000 ₾ в год ⓘ», «отмечено 5 из 6») */
  right?: React.ReactNode;
  /** on a report's page: the head is our grey section, no card; in a story — a card with its head */
  page?: boolean;
  /** «Что уже хорошо»: the card green */
  good?: boolean;
  children: React.ReactNode;
};

/**
 * One block of a report, the same in its story and on its page: a story shows one a screen (a card with its title),
 * a page — one under another, each under its grey section with the title and the total.
 */
export default function ReportBlock({ title, right, page, good, children }: Props) {
  if (page) {
    return (
      <View>
        {title ? <SectionBand title={title} right={right} inset={PAGE_INSET} /> : null}
        <View style={styles.pageBlock}>{children}</View>
      </View>
    );
  }
  return (
    <View style={[styles.block, good && styles.goodBlock]}>
      {title ? (
        <View style={styles.blockHead}>
          <Text style={styles.blockTitle}>{title}</Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}
