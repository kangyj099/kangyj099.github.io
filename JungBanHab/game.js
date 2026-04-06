const canvas = document.getElementById('gameCanvas');
const context = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

///////////////////////////////////////////
// Todo.
// * Matter도입
// * 합 유닛 레벨 도입
// * 합 유닛 최대 레벨 도달시 블랙홀 효과 추가
// * 이펙트 이미지 추가
// * 사운드 추가
// * 유닛에 한자 쓰기.?
///////////////////////////////////////////

/////////////////////////////////////////// 
// 유닛 타입 : 'JUNG' 'BAN' 'HAB' 3가지
//            'JUNG'과 'BAN'만 등장, 같은 레벨의 정과 반을 합쳐 'HAB'합 유닛 만들 수 있음
// 유닛 레벨(단계) : 총 5개 레벨정
//                 정, 반 1~4단계 사용
//                 합 5단계 사용(5단계 합 전용)
///////////////////////////////////////////

///////////////////////////////////////////
//#region 상수 정의
// 유닛 레벨 데이터 (반지름, 무게, 점수)
const LEVELS = [
    { radius: 15, mass: 1, score: 10 },
    { radius: 25, mass: 1.5, score: 30 },
    { radius: 40, mass: 2.5, score: 80 },
    { radius: 60, mass: 4, score: 200 },
    { radius: 85, mass: 8, score: 1000 }   // last, 합HAB 타입
];

// 유닛 타입, enum처럼 선언
const UnitType = Object.freeze({
    JUNG : 'JUNG',
    BAN : 'BAN',
    HAB : 'HAB'
});
const UnitTypeKey = Object.keys(UnitType);

// 유닛 색상
const UnitColor = Object.freeze({
    JUNG : '#3498db',
    BAN : '#e74c3c',
    HAB : '#f1c40f'
});

// ▷ 각종 계수
// 기본 물리
const GRAVITY = 0.2;
const CoF = 0.98; // Coefficient of Friction 마찰계수
const RESTITUTION_Y = 0.3; // Y축 반발계수
const RESTITUTION_X = 0.75; // X축 반발계수

// 자석
const MAGNETIC_RANGE = 150; // Magnetic influence distance 자석 영향력 미치는 거리
const MAGNETIC_FORCE = 0.05; // Magnetic attraction force 자석 인력

//#endregion
///////////////////////////////////////////

let score = 0;  // 점수
let units = []; // 배치된 유닛들
let nextUnitType = UnitType.JUNG;  // 다음 나올 블록 타입, 처음 JUNG고정

class Unit {
    constructor(x, y, type, level)
    {
        this.x = x;
        this.y = y;
        this.type = type;   // 정 반 합 3종만
        this.level = level;
        this.radius = LEVELS[level].radius;
        this.mass = LEVELS[level].mass;
        this.vx = 0;
        this.vy = 0;
        this.isDead = false;
    }

    draw()
    {
        context.beginPath();
        context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        // 타입별 색 지정
        switch (this.type)
        {
            case UnitType.JUNG:
                context.fillStyle = UnitColor.JUNG;
                break;
            case UnitType.BAN:
                context.fillStyle = UnitColor.BAN;
                break;
            case UnitType.HAB:
                context.fillStyle = UnitColor.HAB;
                break;   
        }

        context.fill();
        context.strokeStyle = 'white';
        context.stroke();
        context.closePath();
    }

    update()
    {
        this.x += this.vx;
        this.vx *= CoF;

        this.vy += GRAVITY;
        this.y += this.vy;

        // 충돌 튕김
        // 바닥 충돌 튕김
        if (this.y + this.radius > canvas.height)
        {
            this.y = canvas.height - this.radius;
            this.vy *= -RESTITUTION_Y;  // 힘 감쇠 + 튀어오르기
        }
        // 왼쪽 벽 충돌 튕김
        if (this.x - this.radius < 0)
        {
            this.x = this.radius;
            this.vx *= -RESTITUTION_X;  // 힘 감쇠 + 방향 반대
        }
        // 오른쪽 벽 충돌 튕김
        if (this.x + this.radius > canvas.width)
        {
            this.x = canvas.width - this.radius;
            this.vx *= RESTITUTION_X;   // 힘 감쇠 + 방향 반대
        }
    }
}

function applyMagnetics() {
    for (let i = 0; i < units.length; ++i) {
        for (let j = i + 1; j < units.length; ++j) {
            let u1 = units[i];
            let u2 = units[j];

            // 두 유닛 중심 사이의 거리 측정
            let dx = u2.x - u1.x;
            let dy = u2.y - u1.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            let minDistance = u1.radius + u2.radius;  // 허용되는 가장 가까운 거리

            // u1→u2 노말 벡터
            let normalX = (dx / distance);    // x방향 비율 (척력 노말벡터의 x)
            let normalY = (dy / distance);    // y방향 비율 (척력 노말벡터의 y)

            // 자석 효과 : 일정 거리 안에서 작동, 같은 타입 밀어내고 다른 타입 당김
             if (distance < MAGNETIC_RANGE && distance > minDistance)
             {
                // 같은 속성은 밀어냄
                if (u1.type === u2.type)
                {
                    // 서로 멀어짐
                    u1.vx -= normalX * MAGNETIC_FORCE * 0.5;
                    u2.vx += normalX * MAGNETIC_FORCE * 0.5;
                } else if (u1.type !== UnitType.HAB & u2.type !== UnitType.HAB) // 합이 아닌 서로 다른 속성(정, 반)끼리 당김
                {
                    u1.vx += normalX * MAGNETIC_FORCE;
                    u1.vy += normalY * MAGNETIC_FORCE;
                    u2.vx -= normalX * MAGNETIC_FORCE;
                    u2.vy -= normalY * MAGNETIC_FORCE;
                }
             }

             // 충돌처리, 머지
             if (distance < minDistance)
             {
                // 같은 레벨 유닛끼리 머지
                if (u1.level === u2.level && !u1.isDead && !u2.isDead)
                {
                    // 같은 속성 : 상위 레벨로 진화
                    if (u1.type === u2.type && u1.level < 3)
                    {
                        merge(u1, u2, u1.type, u1.level + 1);
                    }
                    else    // 다른 속성 : 합 발생
                    {
                        merge(u1, u2, UnitType.HAB, 4);
                    }
                }

                // 일반 물리 충돌 (겹침 방지)
                let overlap = minDistance - distance;
                u1.x -= normalX * overlap * 0.5;
                u1.y -= normalY * overlap * 0.5;
                u2.x += normalX * overlap * 0.5;
                u2.y += normalY * overlap * 0.5;
             }
        }
    }
}

function merge(u1, u2, newType, newLevel)
{
    u1.isDead = true;
    u2.isDead = true;

    let newUnit = new Unit((u1.x + u2.x) / 2, (u1.y + u2.y) / 2, newType, newLevel);
    units.push(newUnit);

    score += LEVELS[newLevel].score;
    scoreElement.innerText = 'Score : ${score}';
}

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    units.push(new Unit(x, 50, nextUnitType, 0));
    // 랜덤한 타입의 블럭 고르기, 마지막 타입인 합제외
    nextUnitType = UnitTypeKey[Math.floor(Math.random() * (UnitTypeKey.length - 1))];
});

function loop() {
    context.clearRect(0, 0, canvas.width, canvas.height);

    // 유닛 업데이트, 그리기
    // 죽지 않은 유닛만 남기기
    units = units.filter(u => !u.isDead);
    applyMagnetics();

    units.forEach(u => {
        u.update();
        u.draw();
    });

    // 상단 (실제 블럭 아니고 그려주기만 함)
    context.globalAlpha = 0.5;
    context.fillStyle = UnitColor[nextUnitType];
    
    nextUnitType === UnitType.JUNG ? UnitColor.JUNG : UnitColor.BAN;
    context.beginPath();
    context.arc(200, 30, 15, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1.0;

    requestAnimationFrame(loop);
}

loop();