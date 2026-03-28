const reveals = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.16,
      rootMargin: "0px 0px -24px 0px",
    }
  );

  reveals.forEach((section, index) => {
    section.style.transitionDelay = `${Math.min(index * 60, 180)}ms`;
    observer.observe(section);
  });
} else {
  reveals.forEach((section) => section.classList.add("is-visible"));
}

// Direct download from GitHub releases
function downloadRelease(platform, event) {
  event.preventDefault();
  var link = event.currentTarget;
  var originalText = link.textContent;
  link.textContent = 'Fetching latest release…';

  fetch('https://api.github.com/repos/codedev-david/termpolis/releases/latest')
    .then(function (res) { return res.json(); })
    .then(function (release) {
      var asset = release.assets.find(function (a) {
        var name = a.name.toLowerCase();
        if (platform === 'windows') return name.endsWith('.exe');
        if (platform === 'mac') return name.endsWith('.dmg');
        if (platform === 'linux') return name.endsWith('.appimage');
        return false;
      });
      if (asset) {
        window.location.href = asset.browser_download_url;
      } else {
        window.location.href = 'https://github.com/codedev-david/termpolis/releases/latest';
      }
    })
    .catch(function () {
      window.location.href = 'https://github.com/codedev-david/termpolis/releases/latest';
    })
    .finally(function () {
      link.textContent = originalText;
    });
}
