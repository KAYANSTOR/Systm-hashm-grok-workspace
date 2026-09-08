import React from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Voucher } from "@/lib/types";
import { methodLabel } from "@/lib/labels";
import { useStore } from "@/lib/store";
import ReceiptPrint, { type ReceiptData } from "./ReceiptPrint";

interface VoucherPrintTemplateProps {
  voucher: Voucher;
  partyName: string;
  onClose: () => void;
}

/**
 * The voucher domain model is intentionally kept separate from the print model.
 * This adapter makes every voucher use the same physical receipt identity and
 * avoids maintaining two visually different receipt templates.
 */
export default function VoucherPrintTemplate({ voucher, partyName, onClose }: VoucherPrintTemplateProps) {
  const { settings } = useStore();
  const isReceipt = voucher.type === "receipt";
  const paymentMethod = methodLabel[voucher.paymentMethod];
  const data: ReceiptData = {
    receiptNumber: voucher.voucherNumber,
    date: formatDate(voucher.date),
    receivedFrom: partyName || "—",
    amount: formatCurrency(voucher.amount).replace(/\s*ر\.ي\s*$/, ""),
    transferNumber: voucher.paymentMethod === "cash" ? "—" : paymentMethod,
    network: paymentMethod,
    transferDate: formatDate(voucher.date),
    paymentFor: voucher.description || "—",
    remaining: "—",
    receiver: partyName || "—",
    cashier: settings.name,
    type: isReceipt ? "receipt" : voucher.type === "payment" ? "payment" : "deferred",
  };

  return <ReceiptPrint data={data} onClose={onClose} />;
}
