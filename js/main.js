// Smooth scrolling for navigation links
document.querySelectorAll('nav a[href^="#"]').forEach(link =>
{
    link.addEventListener("click", function (e)
    {
        e.preventDefault();

        const target = document.querySelector(this.getAttribute("href"));

        if (target)
        {
            target.scrollIntoView(
            {
                behavior: "smooth"
            });
        }
    });
});

// Highlight active navigation link while scrolling
const sections = document.querySelectorAll("section");
const navLinks = document.querySelectorAll("nav ul li a");

window.addEventListener("scroll", () =>
{
    let current = "";

    sections.forEach(section =>
    {
        const sectionTop = section.offsetTop - 120;

        if (window.scrollY >= sectionTop)
        {
            current = section.getAttribute("id");
        }
    });

    navLinks.forEach(link =>
    {
        link.classList.remove("active");

        if (link.getAttribute("href") === "#" + current)
        {
            link.classList.add("active");
        }
    });
});

// Reveal sections while scrolling
const observer = new IntersectionObserver(entries =>
{
    entries.forEach(entry =>
    {
        if (entry.isIntersecting)
        {
            entry.target.classList.add("show");
        }
    });
},
{
    threshold: 0.2
});

document.querySelectorAll("section").forEach(section =>
{
    section.classList.add("hidden");
    observer.observe(section);
});

// Welcome message
window.addEventListener("load", () =>
{
    console.log("Laptop Market Research Platform Loaded Successfully");
});