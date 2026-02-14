require("dotenv").config();

const { Documenso } = require("@documenso/sdk-typescript");
const fs = require("node:fs");
const path = require("node:path");

const { API_KEY, SERVER_URL } = process.env;

if (!API_KEY || !SERVER_URL) {
  console.error("Missing API_KEY or SERVER_URL in .env");
  process.exit(1);
}

const documenso = new Documenso({
  apiKey: API_KEY,
  serverURL: SERVER_URL,
});

async function main() {
  const fileBuffer = await fs.promises.readFile(
    path.join(__dirname, "test.pdf"),
  );
  const fileBlob = new Blob([fileBuffer], { type: "application/pdf" });

  console.log("Creating document...");
  const createResult = await documenso.documents.create({
    payload: {
      title: `SDK Test - ${new Date().toLocaleString()}`,
      recipients: [
        {
          email: "test@example.com",
          name: "Test Signer",
          role: "SIGNER",
        },
      ],
      meta: {
        timezone: "America/Vancouver",
        dateFormat: "MM/dd/yyyy hh:mm a",
        language: "en",
        subject: "SDK Field Creation Test",
        message: "Testing the createMany field workaround.",
      },
    },
    file: fileBlob,
  });

  console.log("Document created:", {
    id: createResult.id,
    envelopeId: createResult.envelopeId,
  });

  console.log("Fetching document...");
  const doc = await documenso.documents.get({
    documentId: createResult.id,
  });

  const recipientId = doc.recipients[0].id;
  console.log("Recipient ID:", recipientId);

  console.log("Creating fields (raw fetch workaround)...");
  const fieldsResponse = await fetch(
    `${SERVER_URL}/envelope/field/create-many`,
    {
      method: "POST",
      headers: {
        Authorization: API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        envelopeId: createResult.envelopeId,
        data: [
          {
            recipientId,
            type: "SIGNATURE",
            placeholder: "{{signature,r1}}",
          },
        ],
      }),
    },
  );

  const fieldsResult = await fieldsResponse.json();

  if (!fieldsResponse.ok) {
    console.error(
      "Field creation failed:",
      JSON.stringify(fieldsResult, null, 2),
    );
    process.exit(1);
  }

  console.log("Fields created:", JSON.stringify(fieldsResult, null, 2));

  console.log("Distributing document...");
  const distributeResult = await documenso.documents.distribute({
    documentId: createResult.id,
  });

  console.log(
    "Document distributed:",
    JSON.stringify(distributeResult, null, 2),
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
