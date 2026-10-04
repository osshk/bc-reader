function isIOS(): boolean {
  const ua = navigator.userAgent;
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOs;
}

export type Delivery = "shared" | "opened" | "downloaded";

export async function deliverVCard(vcf: string, filename: string): Promise<Delivery> {
  const file = new File([vcf], filename, { type: "text/vcard" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename.replace(/\.vcf$/i, "") });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
    }
  }

  const blob = new Blob([vcf], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  if (isIOS()) {
    window.location.assign(url);
    return "opened";
  }

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 15_000);
  return "downloaded";
}

export function deliveryMessage(result: Delivery, count: number): string {
  const people = count === 1 ? "This contact" : `${count} people`;
  if (result === "shared") {
    return `${people} went to the share sheet. Choose Contacts to finish filing. Your phone asks before anyone is saved.`;
  }
  if (result === "opened") {
    return "Your iPhone should show the contact card. Tap Add Contact. Nothing is saved until you confirm.";
  }
  if (count > 1) {
    return "Downloaded one card file with everyone. Open it to import into Contacts, Google Contacts, or Outlook. On a phone, this button uses the share sheet instead.";
  }
  return "Downloaded a .vcf file. Open it to import. On iPhone and Android, this same button files the person into Contacts.";
}
