async function run() {
  console.log("Fetching...");
  try {
    const res = await fetch("https://cinne10.top/get.php?username=834443761&password=147387475&type=m3u_plus&output=mpegts", {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    console.log("Status:", res.status);
    let size = 0;
    const reader = res.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
    }
    console.log("Total bytes:", size);
  } catch (err) {
    console.error(err);
  }
}
run();
