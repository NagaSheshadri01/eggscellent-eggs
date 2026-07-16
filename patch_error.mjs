import fs from 'fs';

function fixSupabaseFunctionError(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Create a helper function to extract the real error message
  const helper = `
const extractErrorMsg = async (error: any, data: any, defaultMsg: string) => {
  if (data?.error) return data.error;
  if (!error) return defaultMsg;
  if (error.context && typeof error.context.json === 'function') {
    try {
      const errData = await error.context.json();
      if (errData?.error) return errData.error;
    } catch (e) {}
  }
  return error.message || defaultMsg;
};
`;

  // Insert helper after imports if not already there
  if (!content.includes('extractErrorMsg')) {
    const importMatch = content.match(/import .*?;(\r?\n)+/g);
    if (importMatch) {
      const lastImport = importMatch[importMatch.length - 1];
      const insertIndex = content.lastIndexOf(lastImport) + lastImport.length;
      content = content.substring(0, insertIndex) + helper + content.substring(insertIndex);
    }
  }

  // Replace error handling in send-otp
  content = content.replace(
    /if \(error \|\| !data\?\.ok\) \{\s*toast\.error\(\(error\?\.message\) \|\| \(data\?\.error\) \|\| "Could not send OTP"\);\s*return;\s*\}/g,
    `if (error || !data?.ok) {
      toast.error(await extractErrorMsg(error, data, "Could not send OTP"));
      return;
    }`
  );

  // Replace error handling in verify-otp
  content = content.replace(
    /if \(error \|\| !data\?\.ok \|\| !data\.access_token\) \{\s*toast\.error\(\(error\?\.message\) \|\| \(data\?\.error\) \|\| "Invalid or expired OTP"\);\s*setBusy\(false\);\s*return;\s*\}/g,
    `if (error || !data?.ok || !data.access_token) {
      toast.error(await extractErrorMsg(error, data, "Invalid or expired OTP"));
      setBusy(false);
      return;
    }`
  );

  fs.writeFileSync(filePath, content, 'utf-8');
}

fixSupabaseFunctionError('src/pages/Auth.tsx');
fixSupabaseFunctionError('src/components/site/JitVerifySheet.tsx');
console.log("Patched Auth.tsx and JitVerifySheet.tsx");
