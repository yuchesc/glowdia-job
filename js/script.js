const workLabel = 'テレワーク';
const workEndLabel = '勤務終了';
const restLabel = '休憩時間';

const genres = [];
genres['通常業務（自社）'] = '00';
genres['通常業務（その他）'] = '20';
genres[restLabel] = '13';
genres[workLabel] = '21';
genres[workEndLabel] = '99';
genres['出張移動時間'] = '08';
genres['仮眠'] = '01';
genres['勤務中断'] = '03';
genres['非減算不就業'] = '09';


let defaultPlace;
const defaultProject = 'その他';
const defaultGenre = workLabel;

const waitTime = 1000;

function isPage(name) {
    return window.location.href.includes(name);
}

const timeRe = /^[0-9]{1,2}:[0-9]{1,2}$/;
function adjustTime(hhmm) {
    if (timeRe.test(hhmm)) {
        const arr = hhmm.split(':');
        let minute = parseInt(arr[1], 10);
        if (minute % 6 !== 0) {
            minute = Math.floor(minute / 6) * 6;
        }
        return `${arr[0]}:${('00' + minute).slice(-2)}`;
    } else {
        throw `Invalid time: ${hhmm}`;
    }
}

function parseWorkContent(text) {
    const arr = text.split(' ');

    let project;
    let content;
    if (arr.length === 1) {
        project = defaultProject;
        content = arr[0];
    } else if (arr.length === 2) {
        project = arr[0];
        content = arr[1];
    } else {
        throw 'Not supported: ' + text;
    }

    let place = defaultPlace;
    if (content.indexOf('@') > 0) {
        place = content.slice(content.indexOf('@') + 1);
        content = content.slice(0, content.indexOf('@'));
    }
    return {project: project, content: content, genre: defaultGenre, place: place};
}

function copyWork(work, start, end) {
    const copied = JSON.parse(JSON.stringify(work));
    copied.start = adjustTime(start);
    copied.end = adjustTime(end);
    return copied;
}

function extractJson(text) {
    const start = text.indexOf('{');
    const end = text.indexOf('}');
    if ((start >= 0) && (end > 0) && (start < end)) {
        return text.slice(start, end + 1);
    } else {
        return null;
    }
}

function checkRequired(json, key) {
    if (!json[key]) {
        throw `${key} not found.`;
    }
}

function parseJson(text) {
    const json = JSON.parse(text);
    ['place', 'start', 'end', 'restStart', 'restEnd', 'body'].forEach(key => {
        checkRequired(json, key);
    });
    json.start = adjustTime(json.start);
    json.end = adjustTime(json.end);
    json.restStart = adjustTime(json.restStart);
    json.restEnd = adjustTime(json.restEnd);
    defaultPlace = json.place;
    return json;
}

function parseWorkJson(text) {
    const delimiter = '\t';
    try {
        const json = parseJson(text);

        const works = json.body.split('、');

        const timedWorks = [];
        const noTimeWorks = [];

        for (let i = 0; i < works.length; i++) {
            const work = works[i];
            if (work.indexOf('(') > 0) {
                const content = work.slice(0, work.indexOf('('));
                const time = work.slice(work.indexOf('(') + 1, work.indexOf(')')).split('-'); // (hh:mm-hh:mm) => [hh:mm, hh:mm]
                const tmp = parseWorkContent(content);
                tmp.start = adjustTime(time[0]);
                tmp.end = adjustTime(time[1]);

                timedWorks.push(tmp);
            } else {
                noTimeWorks.push(parseWorkContent(work));
            }
        }

        timedWorks.push({
            project: '',
            content: '',
            genre: restLabel,
            start: json.restStart,
            end: json.restEnd,
            place: ''});
        timedWorks.sort((a, b) => {
            return (a.start < b.start) ? -1 : 1;
        });

        const workStructures = [];
        let noTimeCounter = 0;
        let nextStartTime = json.start;
        let timed;
        let endTime = json.start;
        for (let timedCounter = 0; timedCounter < timedWorks.length; timedCounter++) {
            timed = timedWorks[timedCounter];
            if (timed.start !== nextStartTime) {
                workStructures.push(copyWork(noTimeWorks[noTimeCounter], nextStartTime, timed.start));
                if (noTimeCounter < (noTimeWorks.length - 1)) {
                    noTimeCounter++;
                }
            }
            nextStartTime = timed.end;
            workStructures.push(timed);
        }
        if (nextStartTime !== json.end) {
            workStructures.push(copyWork(noTimeWorks[noTimeCounter], nextStartTime, timed.start));
        }

        let result = '';
        for (let j = 0; j < workStructures.length; j++) {
            const st = workStructures[j];
            result += st.start + delimiter + st.genre + delimiter + st.project + delimiter + st.content + delimiter + st.place + '\n';
        }
        result += json.end + delimiter + workEndLabel;
        return result;
    } catch (e) {
        return e;
    }
}


function applyWorkTimeSchedule() {
    chrome.runtime.sendMessage({cmd: 'popSchedule'}, (response) => {
        if (response) {
            const startTime = response.start.split(':');
            document.getElementById('MainContent_txtDetailHour').value = startTime[0];
            document.getElementById('MainContent_ddlDetailMinute').value = startTime[1];
            document.getElementById('MainContent_ddlWorkKbn').value = genres[response.genre];
            document.getElementById('MainContent_txtProgram').value = response.project;
            document.getElementById('MainContent_txtWork').value = response.content;
            document.getElementById('MainContent_txtWorkshop').value = response.place;
            document.getElementById('MainContent_btnDetailSave').click();
        }
    });
}

window.addEventListener('load', function () {
    // shrink header
    const header = document.getElementById('Master_header');
    if (header) {
        header.style.height = '34px';
    }
    const masterStafNo = document.querySelector('.MasterStaffNo');
    if (masterStafNo) {
        masterStafNo.style.top = '0';
    }

    if (isPage('AAF0300Info.aspx')) {
        chrome.runtime.sendMessage({cmd: 'state'}, (response) => {
            if (response === 'login') {
                chrome.runtime.sendMessage({cmd: 'goto-input'}, () => {
                    location.href = 'ACFS0810TimeChart.aspx?m=1110&h=2';
                });
            }
        });
    } else if (isPage('InputWork.aspx')) {
        chrome.runtime.sendMessage({cmd: 'state'}, (response) => {
            if (response === 'setSchedule') {
                setTimeout(applyWorkTimeSchedule, waitTime);
            } else {
                const area = document.createElement('textarea');
                area.id = 'gl-work-area';
                area.setAttribute('rows', '10');
                area.setAttribute('placeholder', 'TSV');
                area.style.width = '60%';

                const button = document.createElement('button');
                button.innerText = 'Apply';
                button.className = 'BgImageButton BgImageCheck';
                button.style.verticalAlign = 'top';
                button.style.fontSize = 'large';
                button.style.width = '80px';
                button.style.height = '30px';
                button.style.margin = '10px';
                button.onclick = function (e) {
                    chrome.runtime.sendMessage({cmd: 'setSchedule', value: area.value}, () => {
                        applyWorkTimeSchedule(area.value);
                    });
                    e.preventDefault();
                };

                const field = document.createElement('input');
                field.id = 'gl-json-field';
                field.setAttribute('placeholder', 'JSON');
                field.setAttribute('autocomplete', 'off');
                field.style.width = '90%';
                field.addEventListener('keyup', (e) => {
                    const jsonString = extractJson(field.value);
                    if (jsonString !== null) {
                        area.innerHTML = parseWorkJson(jsonString);
                    }
                    e.preventDefault();
                });
                field.addEventListener('keydown', (e) => {
                    if (e.which === 13) {
                        e.preventDefault();
                    }
                });

                const root = document.createElement('div');
                root.style.padding = '10px';
                //root.style.border = 'green solid 5px';
                root.style.background = 'linear-gradient(#ffc4fc, #fd2a6a)';
                root.appendChild(field);
                root.appendChild(document.createElement('br'));
                root.appendChild(area);
                root.appendChild(button);
                //const form = document.querySelector('form')[0];
                //form.parentNode.insertBefore(root, form);
                document.body.insertBefore(root, document.body.childNodes[0]);
            }
        });
    }
}, false);
