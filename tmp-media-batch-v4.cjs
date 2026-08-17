const fs = require("fs");

const file = "./app/developer/media/page.tsx";
let c = fs.readFileSync(file, "utf8");

function mustReplaceRegex(regex, replacement, label) {
  if (!regex.test(c)) {
    throw new Error(`PATCH POINT NOT FOUND: ${label}`);
  }

  c = c.replace(regex, replacement);
  console.log(`PATCHED: ${label}`);
}

/* =========================================================
   1. MULTI-FILE STATE
   ========================================================= */

mustReplaceRegex(
  /const \[selectedFile,\s*setSelectedFile\]\s*=\s*useState<File \| null>\(null\);/,
`const [selectedFiles, setSelectedFiles] =
    useState<File[]>([]);

  const selectedFile =
    selectedFiles[0] || null;`,
  "selected file state"
);

/* =========================================================
   2. FILE CHANGE HANDLER
   Stop exactly before deleteMedia so Delete Media survives.
   ========================================================= */

mustReplaceRegex(
  /  function handleFileChange\([\s\S]*?\n  }\n  async function deleteMedia\(item: MediaItem\) \{/,
`  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const nextFiles =
      Array.from(
        event.target.files || []
      );

    setSelectedFiles(nextFiles);
    setError("");
    setNotice("");
    setUploadState("idle");
    setUploadPercent(0);

    if (nextFiles.length === 1) {
      setTitle(
        nextFiles[0].name.replace(
          /\\.[^.]+$/,
          ""
        )
      );
    } else {
      setTitle("");
    }
  }

  async function deleteMedia(item: MediaItem) {`,
  "file selection handler"
);

/* =========================================================
   3. BATCH UPLOAD FUNCTION
   Replace uploadMedia only.
   ========================================================= */

mustReplaceRegex(
  /  async function uploadMedia\(\) \{[\s\S]*?\n  }\n\n  if \(loading\) \{/,
`  async function uploadMedia() {
    if (!user || !isOwner) return;

    if (selectedFiles.length === 0) {
      setError(
        "Choose one or more media files first."
      );
      return;
    }

    setError("");
    setNotice("");
    setUploadPercent(0);

    const totalFiles =
      selectedFiles.length;

    let completedFiles = 0;

    try {
      const token =
        await user.getIdToken();

      for (
        let index = 0;
        index < selectedFiles.length;
        index += 1
      ) {
        const currentFile =
          selectedFiles[index];

        const currentTitle =
          selectedFiles.length === 1 &&
          title.trim()
            ? title.trim()
            : currentFile.name.replace(
                /\\.[^.]+$/,
                ""
              );

        const fileInfo = {
          name: currentFile.name,
          type:
            currentFile.type ||
            "application/octet-stream",
          size: currentFile.size,
        };

        setUploadState(
          "preparing"
        );

        setNotice(
          \`Preparing \${index + 1} of \${totalFiles}: \${currentFile.name}\`
        );

        const prepareResponse =
          await fetch(
            "/api/owner/media",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
                Authorization:
                  \`Bearer \${token}\`,
              },
              body: JSON.stringify({
                action: "prepare",
                file: fileInfo,
              }),
            }
          );

        const prepareData =
          await prepareResponse.json();

        if (
          !prepareResponse.ok ||
          !prepareData.success
        ) {
          throw new Error(
            prepareData.error ||
              \`Could not prepare \${currentFile.name}.\`
          );
        }

        setUploadState(
          "uploading"
        );

        setNotice(
          \`Uploading \${index + 1} of \${totalFiles}: \${currentFile.name}\`
        );

        const uploadResponse =
          await fetch(
            prepareData.uploadUrl,
            {
              method: "PUT",
              headers: {
                "Content-Type":
                  currentFile.type ||
                  "application/octet-stream",
              },
              body: currentFile,
            }
          );

        if (!uploadResponse.ok) {
          throw new Error(
            \`Firebase upload failed for \${currentFile.name} (\${uploadResponse.status}).\`
          );
        }

        setUploadState(
          "finalizing"
        );

        setNotice(
          \`Saving \${index + 1} of \${totalFiles}: \${currentFile.name}\`
        );

        const finalizeResponse =
          await fetch(
            "/api/owner/media",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
                Authorization:
                  \`Bearer \${token}\`,
              },
              body: JSON.stringify({
                action: "finalize",
                mediaId:
                  prepareData.mediaId,
                storagePath:
                  prepareData.storagePath,
                title:
                  currentTitle,
                file:
                  fileInfo,
              }),
            }
          );

        const finalizeData =
          await finalizeResponse.json();

        if (
          !finalizeResponse.ok ||
          !finalizeData.success
        ) {
          throw new Error(
            finalizeData.error ||
              \`Could not finalize \${currentFile.name}.\`
          );
        }

        completedFiles += 1;

        setUploadPercent(
          Math.round(
            (
              completedFiles /
              totalFiles
            ) * 100
          )
        );
      }

      setUploadState("done");
      setUploadPercent(100);

      setNotice(
        totalFiles === 1
          ? "Media added to the Central Media Library."
          : \`\${totalFiles} files added to the Central Media Library.\`
      );

      setSelectedFiles([]);
      setTitle("");

      const input =
        document.getElementById(
          "media-upload-input"
        );

      if (
        input instanceof
        HTMLInputElement
      ) {
        input.value = "";
      }

      await loadMedia(user);
    } catch (err) {
      setUploadState("error");

      setError(
        err instanceof Error
          ? err.message
          : "Media batch upload failed."
      );

      if (completedFiles > 0) {
        setNotice(
          \`\${completedFiles} of \${totalFiles} files completed before the error.\`
        );
      }
    }
  }

  if (loading) {`,
  "batch upload function"
);

/* =========================================================
   4. ENABLE MULTIPLE FILE SELECTION
   ========================================================= */

mustReplaceRegex(
  /id="media-upload-input"\s*\n\s*type="file"\s*\n\s*accept=/,
`id="media-upload-input"
                type="file"
                multiple
                accept=`,
  "multiple file input"
);

fs.writeFileSync(
  file,
  c,
  "utf8"
);

console.log("");
console.log("V4 PATCH INSTALLED");
