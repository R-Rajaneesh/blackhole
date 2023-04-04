document.getElementById("ad-control").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const type = ev.submitter.className === "block" ? "blocked" : "allowed";
  const domain = ev.target[0].value;
  if (!domain.length) {
    alert("Provide a valid domain");
    return;
  }
  const data = (await axios.patch("/api/updatetype", { domain: domain, type: type })).data.data;
  alert(`${domain} has been ${data.type}`);
  ev.target[0].value = "";
});
