function wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function fetch_all_notes() {
    var num_notes = 0;
    while (num_notes < (num_notes = window.__INITIAL_STATE__.user.notes._rawValue[0].length)) {
        document.dispatchEvent(new Event("scroll"));
        await wait(500);
    }
}

async function pass_initial_state() {
    await fetch_all_notes();
    // var span = document.getElementById("initial_state");
    // span.textContent = JSON.stringify(window.__INITIAL_STATE__);
    // span.dispatchEvent(new CustomEvent("initial_state_ready"));
    var state = window.__INITIAL_STATE__;
    document.dispatchEvent(new CustomEvent("initial_state_ready", { detail: JSON.stringify(state) }));
}

pass_initial_state();
