const { randomUUID, createHash } = require("crypto");
const fs = require("fs");

const SECRET = "5CE3DF4D45AC";

async function uploadImage() {
  const imageBuffer = fs.readFileSync("resim.png");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const appId = randomUUID();

  // Farklı kombinasyonları dene
  const hashVariants = [
    {
      name: "SECRET+ts",
      hash: createHash("md5")
        .update(SECRET + timestamp)
        .digest("hex"),
    },
    {
      name: "ts+SECRET",
      hash: createHash("md5")
        .update(timestamp + SECRET)
        .digest("hex"),
    },
    {
      name: "SECRET*ts",
      hash: createHash("md5")
        .update(SECRET + "*" + timestamp)
        .digest("hex"),
    },
    {
      name: "ts*SECRET",
      hash: createHash("md5")
        .update(timestamp + "*" + SECRET)
        .digest("hex"),
    },
    {
      name: "SECRET:ts",
      hash: createHash("md5")
        .update(SECRET + ":" + timestamp)
        .digest("hex"),
    },
    {
      name: "ts:SECRET",
      hash: createHash("md5")
        .update(timestamp + ":" + SECRET)
        .digest("hex"),
    },
  ];

  console.log("Timestamp:", timestamp);
  console.log("Testing hash variants...\n");

  for (const v of hashVariants) {
    console.log(`=== ${v.name} ===`);
    console.log("Hash:", v.hash);

    const formData = new FormData();
    formData.append("width", "220");
    formData.append("height", "114");
    formData.append("dpi", "1.000000");
    formData.append("app_id", appId);

    const imageBlob = new Blob([imageBuffer], { type: "image/png" });
    formData.append("image", imageBlob, "screenshot.png");

    try {
      const response = await fetch(`https://upload.prntscr.com/upload/${timestamp}/${v.hash}/`, {
        method: "POST",
        body: formData,
      });

      const text = await response.text();
      console.log("Response:", text);

      if (text.includes("success")) {
        console.log("\n*** SUCCESS with", v.name, "***");
        const shareMatch = text.match(/<share>([^<]+)<\/share>/);
        if (shareMatch) console.log("Share URL:", shareMatch[1]);
        return;
      }
    } catch (err) {
      console.error("Error:", err.message);
    }
    console.log("");
  }
}

uploadImage();
