import assert from "node:assert/strict";

const {
  pickLatestSectionSignature,
  readSectionSignaturesFromFormData,
} = await import("../../app/lib/signature-pad-form.ts");

{
  const formData = new FormData();
  formData.set("sectionSignatures.sec-env", "data:image/jpeg;base64,abc");
  assert.deepEqual(readSectionSignaturesFromFormData(formData), {
    "sec-env": "data:image/jpeg;base64,abc",
  });
}

{
  const formData = new FormData();
  formData.set("sectionSignatures[sec-env]", "data:image/jpeg;base64,legacy");
  assert.deepEqual(readSectionSignaturesFromFormData(formData), {
    "sec-env": "data:image/jpeg;base64,legacy",
  });
}

{
  assert.equal(
    pickLatestSectionSignature({
      "sec-a": "first",
      "sec-b": "second",
    }),
    "second",
  );
  assert.equal(pickLatestSectionSignature({}), null);
}

console.log("signature-pad-form unit tests passed");
