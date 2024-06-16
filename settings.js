window.onload = () => {
    var clear = document.getElementById("clear");
    var clear_handler = function () {
        chrome.storage.local.clear();
        clear.removeEventListener("click", clear_handler);
        clear.getElementsByTagName("span")[0].textContent = "Done!";
        clear.getElementsByTagName("a")[0].style.cursor = "default";
    }
    clear.addEventListener("click", clear_handler);
};