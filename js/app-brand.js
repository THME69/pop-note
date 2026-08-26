// Petite mention "PopNote" discrète en bas à droite de chaque page de
// l'app — y compris les futures pages : il suffit d'inclure ce script.
// Seul l'écran de sélection de profil (identifié par #profileGrid, unique à
// index.html) ne l'affiche pas.
if (!document.getElementById("profileGrid")) {
  const brand = document.createElement("p");
  brand.className = "app-brand";
  brand.textContent = "PopNote";
  document.body.appendChild(brand);
}
