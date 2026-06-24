import type { Metadata } from "next";

import { LegalDocument } from "../components/legal-document";

export const metadata: Metadata = {
  title: "Legal statement",
  description: "Publisher and company contact details for Abra.",
};

const supportEmail = "filipp@trigub.tech";

export default function LegalPage() {
  return (
    <LegalDocument
      title="Legal statement"
      description="The information below identifies the company operating Abra and the general service contact details."
      lastUpdated="Last updated: June 24, 2026"
      relatedLinks={[{ href: "/privacy", label: "Privacy note" }]}
      sections={[
        {
          title: "Service operator",
          body: (
            <>
              <p>
                <strong>TRIGUB TECHNOLOGIES OÜ</strong>
                <br />
                Harju maakond, Tallinn, Kesklinna linnaosa, Narva mnt 5, 10117 Estonia
              </p>
              <p>
                Trading name: Trigub Technologies
                <br />
                Product: Abra
                <br />
                Contact: <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
              </p>
            </>
          ),
        },
        {
          title: "Contact and contracting address",
          body: (
            <p>
              Contact and contracting correspondence address: Narva mnt 5, Tallinn, 10117 Estonia.
            </p>
          ),
        },
        {
          title: "Useful references",
          body: (
            <p>
              For more information about data handling, review the <a href="/privacy">Privacy note</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
