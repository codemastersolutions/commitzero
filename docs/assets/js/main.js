// Site Configuration
const siteConfig = {
  title: "CommitZero Documentation",
  description: "Conventional Commits validator with friendly CLI",
  baseUrl: "https://codemastersolutions.github.io/commitzero",
  languages: {
    en: { label: "English", path: "/" },
    "pt-br": { label: "Português", path: "/pt-br/" },
    es: { label: "Español", path: "/es/" },
  },
  navigation: [
    { title: "Home", path: "/", icon: "home" },
    { title: "Installation", path: "/installation", icon: "download" },
    { title: "Configuration", path: "/configuration", icon: "settings" },
    { title: "Usage", path: "/usage", icon: "terminal" },
    { title: "API Reference", path: "/api-reference", icon: "code" },
    { title: "Examples", path: "/examples", icon: "book-open" },
    { title: "Contributing", path: "/contributing", icon: "users" },
    { title: "FAQ", path: "/faq", icon: "help-circle" },
    { title: "Changelog", path: "/changelog", icon: "clock" },
  ],
};

// Theme Management
class ThemeManager {
  constructor() {
    this.theme = localStorage.getItem("theme") || "light";
    this.init();
  }

  init() {
    this.applyTheme();
    this.setupToggle();
  }

  applyTheme() {
    if (this.theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", this.theme);
  }

  toggle() {
    this.theme = this.theme === "light" ? "dark" : "light";
    this.applyTheme();
    this.updateToggleButton();
  }

  setupToggle() {
    const toggleButton = document.getElementById("theme-toggle");
    if (toggleButton) {
      toggleButton.addEventListener("click", () => this.toggle());
      this.updateToggleButton();
    }
  }

  updateToggleButton() {
    const toggleButton = document.getElementById("theme-toggle");
    if (toggleButton) {
      const icon = toggleButton.querySelector("svg");
      if (this.theme === "dark") {
        icon.innerHTML = `
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        `;
      } else {
        icon.innerHTML = `
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        `;
      }
    }
  }
}

// Mobile Navigation
class MobileNav {
  constructor() {
    this.isOpen = false;
    this.init();
  }

  init() {
    const toggleButton = document.getElementById("mobile-menu-toggle");
    const mobileMenu = document.getElementById("mobile-menu");

    if (toggleButton && mobileMenu) {
      toggleButton.addEventListener("click", () => this.toggle());

      // Close menu when clicking outside
      document.addEventListener("click", (e) => {
        if (!toggleButton.contains(e.target) && !mobileMenu.contains(e.target)) {
          this.close();
        }
      });
    }
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    this.isOpen = true;
    const mobileMenu = document.getElementById("mobile-menu");
    if (mobileMenu) {
      mobileMenu.classList.remove("hidden");
      mobileMenu.classList.add("animate-slide-up");
    }
  }

  close() {
    this.isOpen = false;
    const mobileMenu = document.getElementById("mobile-menu");
    if (mobileMenu) {
      mobileMenu.classList.add("hidden");
      mobileMenu.classList.remove("animate-slide-up");
    }
  }
}

// Copy to Clipboard
class ClipboardManager {
  constructor() {
    this.init();
  }

  init() {
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("copy-button") || e.target.closest(".copy-button")) {
        const button = e.target.classList.contains("copy-button")
          ? e.target
          : e.target.closest(".copy-button");
        this.copyCode(button);
      }
    });
  }

  async copyCode(button) {
    const codeBlock = button.closest(".code-block").querySelector("code");
    const text = codeBlock.textContent;

    try {
      await navigator.clipboard.writeText(text);
      this.showCopyFeedback(button);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  }

  showCopyFeedback(button) {
    const originalText = button.innerHTML;
    button.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
    `;

    setTimeout(() => {
      button.innerHTML = originalText;
    }, 2000);
  }
}

// Search Functionality
class SearchManager {
  constructor() {
    this.searchIndex = [];
    this.init();
  }

  init() {
    this.buildSearchIndex();
    this.setupSearch();
  }

  buildSearchIndex() {
    // Build search index from page content
    const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
    const paragraphs = document.querySelectorAll("p");
    const codeBlocks = document.querySelectorAll("code");

    headings.forEach((heading, index) => {
      this.searchIndex.push({
        id: `heading-${index}`,
        title: heading.textContent,
        content: heading.textContent,
        url: `#${heading.id || ""}`,
        category: "heading",
      });
    });

    paragraphs.forEach((p, index) => {
      if (p.textContent.length > 20) {
        this.searchIndex.push({
          id: `paragraph-${index}`,
          title: p.textContent.substring(0, 50) + "...",
          content: p.textContent,
          url: `#${p.closest("section")?.id || ""}`,
          category: "content",
        });
      }
    });

    codeBlocks.forEach((code, index) => {
      if (code.textContent.length > 10) {
        this.searchIndex.push({
          id: `code-${index}`,
          title: "Code Example",
          content: code.textContent,
          url: `#${code.closest("section")?.id || ""}`,
          category: "code",
        });
      }
    });
  }

  setupSearch() {
    const searchInput = document.getElementById("search-input");
    const searchResults = document.getElementById("search-results");

    if (searchInput && searchResults) {
      searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();

        if (query.length < 2) {
          searchResults.classList.add("hidden");
          return;
        }

        const results = this.search(query);
        this.displayResults(results, searchResults);
      });

      // Hide results when clicking outside
      document.addEventListener("click", (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
          searchResults.classList.add("hidden");
        }
      });
    }
  }

  search(query) {
    return this.searchIndex
      .filter(
        (item) =>
          item.title.toLowerCase().includes(query) || item.content.toLowerCase().includes(query)
      )
      .slice(0, 5); // Limit to 5 results
  }

  displayResults(results, container) {
    if (results.length === 0) {
      container.innerHTML = '<div class="p-4 text-gray-500">No results found</div>';
    } else {
      container.innerHTML = results
        .map(
          (result) => `
        <a href="${result.url}" class="block p-4 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
          <div class="font-medium text-gray-900 dark:text-gray-100">${result.title}</div>
          <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">${result.content.substring(0, 100)}...</div>
          <div class="text-xs text-primary-600 dark:text-primary-400 mt-1">${result.category}</div>
        </a>
      `
        )
        .join("");
    }

    container.classList.remove("hidden");
  }
}

// Language Switcher
class LanguageSwitcher {
  constructor() {
    this.currentLang = this.detectLanguage();
    this.init();
  }

  detectLanguage() {
    const path = window.location.pathname;
    if (path.startsWith("/pt-br/")) return "pt-br";
    if (path.startsWith("/es/")) return "es";
    return "en";
  }

  init() {
    const langSwitcher = document.getElementById("language-switcher");
    if (langSwitcher) {
      this.setupSwitcher(langSwitcher);
    }
  }

  setupSwitcher(switcher) {
    const currentLangButton = switcher.querySelector("[data-current-lang]");
    const dropdown = switcher.querySelector("[data-lang-dropdown]");

    if (currentLangButton) {
      currentLangButton.textContent = siteConfig.languages[this.currentLang].label;

      currentLangButton.addEventListener("click", () => {
        dropdown.classList.toggle("hidden");
      });
    }

    // Setup language links
    const langLinks = switcher.querySelectorAll("[data-lang]");
    langLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const targetLang = link.dataset.lang;
        this.switchLanguage(targetLang);
      });
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!switcher.contains(e.target)) {
        dropdown.classList.add("hidden");
      }
    });
  }

  switchLanguage(targetLang) {
    const currentPath = window.location.pathname;
    let newPath = currentPath;

    // Remove current language prefix
    if (this.currentLang === "pt-br") {
      newPath = newPath.replace("/pt-br", "");
    } else if (this.currentLang === "es") {
      newPath = newPath.replace("/es", "");
    }

    // Add new language prefix
    if (targetLang === "pt-br") {
      newPath = "/pt-br" + newPath;
    } else if (targetLang === "es") {
      newPath = "/es" + newPath;
    }

    // Ensure path starts with /
    if (!newPath.startsWith("/")) {
      newPath = "/" + newPath;
    }

    window.location.href = newPath;
  }
}

// Scroll Spy for Navigation
class ScrollSpy {
  constructor() {
    this.sections = [];
    this.init();
  }

  init() {
    this.sections = Array.from(document.querySelectorAll("section[id]"));
    if (this.sections.length > 0) {
      window.addEventListener("scroll", () => this.updateActiveSection());
      this.updateActiveSection();
    }
  }

  updateActiveSection() {
    const scrollPosition = window.scrollY + 100;

    let activeSection = null;
    this.sections.forEach((section) => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;

      if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
        activeSection = section;
      }
    });

    // Update navigation links
    const navLinks = document.querySelectorAll(".nav-link");
    navLinks.forEach((link) => {
      link.classList.remove("nav-link-active");
      link.classList.add("nav-link-inactive");

      if (activeSection && link.getAttribute("href") === `#${activeSection.id}`) {
        link.classList.add("nav-link-active");
        link.classList.remove("nav-link-inactive");
      }
    });
  }
}

// External API Integration
class APIManager {
  constructor() {
    this.npmData = null;
    this.githubData = null;
  }

  async fetchNpmData() {
    try {
      const response = await fetch("https://registry.npmjs.org/@codemastersolutions/commitzero");
      this.npmData = await response.json();
      this.updateNpmStats();
    } catch (error) {
      console.error("Failed to fetch npm data:", error);
    }
  }

  async fetchGitHubData() {
    try {
      const response = await fetch("https://api.github.com/repos/codemastersolutions/commitzero");
      this.githubData = await response.json();
      this.updateGitHubStats();
    } catch (error) {
      console.error("Failed to fetch GitHub data:", error);
    }
  }

  updateNpmStats() {
    if (!this.npmData) return;

    const versionElement = document.getElementById("npm-version");
    const licenseElement = document.getElementById("npm-license");

    if (versionElement) {
      versionElement.textContent = this.npmData.version || "0.0.13";
    }

    if (licenseElement) {
      licenseElement.textContent = this.npmData.license || "MIT";
    }
  }

  updateGitHubStats() {
    if (!this.githubData) return;

    const starsElement = document.getElementById("github-stars");
    const forksElement = document.getElementById("github-forks");

    if (starsElement) {
      starsElement.textContent = this.githubData.stargazers_count || "0";
    }

    if (forksElement) {
      forksElement.textContent = this.githubData.forks_count || "0";
    }
  }

  init() {
    this.fetchNpmData();
    this.fetchGitHubData();
  }
}

// Initialize everything when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new ThemeManager();
  new MobileNav();
  new ClipboardManager();
  new SearchManager();
  new LanguageSwitcher();
  new ScrollSpy();
  new APIManager().init();

  // Add fade-in animation to main content
  const mainContent = document.querySelector("main");
  if (mainContent) {
    mainContent.classList.add("animate-fade-in");
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });
});
