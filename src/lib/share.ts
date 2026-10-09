function isIOS(): boolean {
  const ua = navigator.userAgent;
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOs;
}

export type Delivery = "shared" | "opened" | "downloaded";

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function deliverVCard(vcf: string, filename: string): Promise<Delivery> {
  // iPhone: skip the share sheet (Contacts is not offered there). Open the card
  // from the server so iOS shows its own contact screen.
  if (isIOS()) {
    const name = filename.replace(/\.vcf$/i, "");
    window.location.assign(`/api/vcard?n=${encodeURIComponent(name)}&d=${toBase64Url(vcf)}`);
    return "opened";
  }
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
    return "Your iPhone should show the contact card. Tap Create New Contact. In Chrome, tap Open in Contacts first. Nothing is saved until you confirm.";
  }
  if (count > 1) {
    return "Downloaded one card file with everyone. Open it to import into Contacts, Google Contacts, or Outlook. On a phone, this button uses the share sheet instead.";
  }
  return "Downloaded a .vcf file. Open it to import. On iPhone and Android, this same button files the person into Contacts.";
}
