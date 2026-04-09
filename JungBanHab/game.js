
///////////////////////////////////////////
// Todo.
// * 이펙트 이미지 추가
// * 사운드 추가
// * 유닛에 한자 쓰기.?
///////////////////////////////////////////

/////////////////////////////////////////// 
// 유닛 타입 : 'JUNG' 'BAN' 'HAB' 3가지
//            'JUNG'과 'BAN'만 등장, 같은 레벨의 정과 반을 합쳐 다음 레벨의 'HAB'합 유닛 만들 수 있음
// 유닛 레벨(단계) : 총 5개 레벨정
//                 정, 반 1~4단계 사용
//                 합 5단계 사용(5단계 합 전용)
///////////////////////////////////////////

///////////////////////////////////////////
//#region 설정 정의
const BASE_WIDTH = 400;
const BASE_HEIGHT = 600;

// 유닛 레벨 데이터 (반지름, 무게, 점수)
const LEVELS = [
    { circleRadius: 20, mass: 1, score: 10 },
    { circleRadius: 35, mass: 2, score: 30 },
    { circleRadius: 55, mass: 4, score: 80 },
    { circleRadius: 80, mass: 8, score: 150 },
    { circleRadius: 110, mass: 16, score: 1000 }   // last, 합HAB 전용 타입
];
const HAB_RADIUS_MULTI = 1.2;   // 합 크기 배수

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
const GUIDE_STROKE_COLOR = '#ffffff33';

// ▷ 각종 계수
const DROP_Y = 50;
const DROP_LV1_RATIO = 0.3; // 1레벨 드랍 확률. 1LV 아닌 경우 0LV (백분율)
const SPAWN_DELAY_MILLI = 500;  // 스폰과 스폰 사이 최소 시간간격

// 기본 물리
const GRAVITY = 0.2;
const FRICTION = 0.2; // 마찰계수
const RESTITUTION = 0.5; // 반발계수

// 자석
const MAGNETIC_RANGE_MULTI = 2; // 자석 영향력 미치는 거리 반지름 배수
const MAGNETIC_ATTRACTION_FORCE = 0.0005;   // 자석 인력
const MAGNETIC_REPULSION_FORCE = 0.0005;    // 자석 척력

// 블랙홀
const BLACKHOLE_LIFETIME_MILLI = 8000; // 블랙홀 유지시간
const BLACKHOLE_RANGEL = 30;   // 블랙홀 영향력 미치는 거리
const BLACKHOLE_FORCE = 0.003;
const BLACKHOLE_SRINK_SPEED = 0.98; // 거리 줄어드는 속도 변화율 (1에 가까울수록 천천히)
const BLACKHOLE_ROTATION_SPEED = 0.05;  // 회전 속도 (클수록 빠름)
const BLACKHOLE_SCALE_DIM = 0.99;  // 빨려들어가면서 크기 줄어드는 변화율

// 머지 폭발
const EXPLOSION_FORCE = 0.5;
const EXPLOSION_FORCE_MULTI = 1;
const EXPLOSION_FORCE_MULTI_HAB = 2.5;

//#endregion
///////////////////////////////////////////

///////////////////////////////////////////
//#region 세팅
const canvas = document.getElementById('gameCanvas');
const context = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

// Matter.js 모듈
const { Engine, Render, Runner, Bodies, Composite, Vector, Mouse, MouseConstraint, Events, Body } = Matter;
const engine = Engine.create();
const world = engine.world;

// 렌더러 생성
const render = Render.create({
    canvas: canvas,
    engine: engine,
    options: {
        width: BASE_WIDTH,
        height: BASE_HEIGHT,
        background: '#222',
        wireframes: false,
        hasBounds: true
    }
});

// 바닥, 벽 설정
const ground = Bodies.rectangle(200, 610, 410, 60, { isStatic: true, friction: 0.5 });
const leftWall = Bodies.rectangle(-10, 300, 20, 600, { isStatic: true, friction: 0.5 });
const rightWall = Bodies.rectangle(410, 300, 20, 600, { isStatic: true, friction: 0.5 });
Composite.add(world, [ground, leftWall, rightWall]);

Render.run(render);
// 엔진 돌리기
const runner = Runner.create();
Runner.run(runner, engine);
//#endregion
///////////////////////////////////////////

let score = 0;  // 점수
let nextUnitType = UnitType.JUNG;  // 다음 나올 블록 타입, 처음 JUNG고정
let nextUnitLevel = 0;
let mouseX = BASE_WIDTH / 2;
let isSpawning = false;

// 다음 유닛 미리보기 그리기
Events.on(render, 'afterRender', () => {
    const radius = LEVELS[nextUnitLevel].circleRadius;
    const color = UnitColor[nextUnitType];
    const dropY = DROP_Y;
    let dropX = mouseX;
    if (dropX + radius > BASE_WIDTH)
    {
        dropX = BASE_WIDTH - radius;
    }
    if (dropX - radius < 0)
    {
        dropX = radius;
    }

    context.save();
    context.globalAlpha = 0.6;  // 반투명하게 그리기
    
    // 떨어지는 위치 가이드라인 그리기
    context.beginPath();
    context.setLineDash([5, 5]);
    context.moveTo(dropX, dropY);
    context.lineTo(dropX, BASE_HEIGHT);
    context.strokeStyle = GUIDE_STROKE_COLOR; // 알파를 위해 rgba사용
    context.stroke();

    // 다음 유닛 미리보기
    context.beginPath();
    context.arc(dropX, dropY, radius, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
    context.strokeStyle = '#fff';
    context.stroke();

    context.restore();
});

//#region 게임 로직
// 유닛 생성
function spawnUnit(x, y, type, level)
{
    const color = UnitColor[type];
    data = LEVELS[level];
    // 합 크기보정(1.2배)
    circleRadius = (type === UnitType.HAB) ? data.circleRadius * HAB_RADIUS_MULTI : data.circleRadius;

    const unit = Bodies.circle(x, y, circleRadius, {
        restitution: RESTITUTION,   // 통통이
        friction: FRICTION,
        mass: data.mass,
        render: { fillStyle: color, strokeStyle: '#fff', lineWidth: 2 }
    });

    unit.unitType = type;
    unit.level = level;
    unit.isHab = type === UnitType.HAB ? true : false;

    // 합 보정
    if (unit.isHab)
    {
        // 최고레벨 합인 경우 소멸 프로토콜 가동!
        if (level === LEVELS.length - 1)
        {
            startBlackHoleSequence(unit);
        }
    }

    Composite.add(world, unit);

    console.log(x, y, type, color, level);

    return unit;
}

// 자석 로직
Events.on(engine, 'beforeUpdate', () => {
    const bodies = Composite.allBodies(world);

    bodies.forEach((bodyA, i) => {
        if (bodyA.isStatic)
        {
            return;
        }

        // 블랙홀 효과 (최종레벨 합의 효과)
        if (bodyA.isHab && bodyA.level === LEVELS.length - 1)
        {
            console.log('블랙홀 효과 시작');

            bodies.forEach(bodyB => {
                if (bodyA === bodyB || bodyB.isStatic || bodyB.isSwallowed)
                {
                    return;
                }

                const vecDist = Vector.sub(bodyA.position, bodyB.position);
                const distance = Vector.magnitude(vecDist);

                if (distance < bodyA.circleRadius + BLACKHOLE_RANGEL)
                {
                    if (distance * 1.2 <= bodyA.circleRadius + bodyB.circleRadius)
                    {
                        absorbUnit(bodyA, bodyB);
                    }
                    else
                    {
                        console.log('블랙홀로이동');
                        Body.applyForce(bodyB, bodyB.position, Vector.mult(Vector.normalise(vecDist), BLACKHOLE_FORCE * bodyB.mass));
                    }
                }
            });
        }

        // 일반 자석 효과
        for (let j = i + 1; j < bodies.length; ++j)
        {
            const bodyB = bodies[j];
            if (bodyB.isStatic || bodyA.isHab || bodyB.isHab)
            {
                continue;
            }

            const vecAtoB = Vector.sub(bodyB.position, bodyA.position);
            if (Vector.magnitude(vecAtoB) < (bodyA.circleRadius + bodyB.circleRadius) * MAGNETIC_RANGE_MULTI)
            {
                const force = (bodyA.unitType === bodyB.unitType) ? -MAGNETIC_REPULSION_FORCE : MAGNETIC_ATTRACTION_FORCE;
                Body.applyForce(bodyA, bodyA.position, Vector.mult(Vector.normalise(vecAtoB), force));
                Body.applyForce(bodyB, bodyB.position, Vector.mult(Vector.normalise(vecAtoB), -force));
            }
        }
    });
});

// 충돌 이벤트
Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;

        if (bodyA.isStatic || bodyB.isStatic)
        {
            return;
        }
        if (bodyA.level !== bodyB.level || bodyA.isHab !== bodyB.isHab)
        {
            return;
        }

        const midPos = Vector.mult(Vector.add(bodyA.position, bodyB.position), 0.5);

        // 같은 속성 레벨업 
        if (bodyA.unitType === bodyB.unitType)
        {
            if (bodyA.level > LEVELS.length - (bodyA.isHab ? 2 : 3))
            {
                return;
            }

            Composite.remove(world, [bodyA, bodyB]);
            spawnUnit(midPos.x, midPos.y, bodyA.unitType, bodyA.level + 1);
            applyExplosion(midPos.x, midPos.y, EXPLOSION_FORCE_MULTI);
            updateScore(LEVELS[bodyA.level + 1].score);
        }
        else if (!bodyA.isHab && !bodyB.isHab)// 다른 속성 머지
        {
            Composite.remove(world, [bodyA, bodyB]);
            spawnUnit(midPos.x, midPos.y, UnitType.HAB, bodyA.level + 1);
            applyExplosion(midPos.x, midPos.y, EXPLOSION_FORCE_MULTI_HAB);
            updateScore(LEVELS[bodyA.level + 1].score * 2);
        }
    });
});

// 폭발효과(머지할 때 발생)
function applyExplosion(x, y, multi)
{
    Composite.allBodies(world).forEach(b =>{
        if (b.isStatic)
        {
            return;
        }

        const vecPosToB = Vector.sub(b.position, {x, y});
        if (Vector.magnitude(vecPosToB) < b.circleRadius * MAGNETIC_RANGE_MULTI)
        {
            Body.applyForce(b, b.position, Vector.mult(Vector.normalise(vecPosToB), EXPLOSION_FORCE * 4));
        }
    });
}

// 블랙홀 소멸 시퀀스
function startBlackHoleSequence(blackHoleUnit)
{
    Body.setVelocity(blackHoleUnit, { x: 0, y: 0 });
    blackHoleUnit.render.fillStyle = UnitColor.HAB + '30';
    blackHoleUnit.isSensor = true;  // 경계의 유닛 자연스러운 흡수를 위함
    blackHoleUnit.isSleeping = true;    // 추락 방지 물리 자장자장

    setTimeout(() => {        
        // 블랙홀 영역 내의 끌려오는 유닛 삭제 (absorbUnit::swallowUpdate에도 같은 동작 있지만 안전장치)
        Composite.allBodies(world).forEach(bodyB => {
            if (!bodyB.isSwallowed)
            {
                return;
            }
            
            distance = Vector.magnitude(Vector.sub(blackHoleUnit.position, bodyB.position));
            if (distance < blackHoleUnit.circleRadius)
            {
                Composite.remove(world, bodyB);
            
                // 점수 추가
                updateScore(LEVELS[bodyB.level].score);
            }
        });

        Composite.remove(world, blackHoleUnit);
    }, BLACKHOLE_LIFETIME_MILLI);
}

// 블랙홀 효과(최고레벨 합 유닛에서 발생) : 블랙홀 중심으로 유닛을 빨아들이고 소멸시키는 동작 예약
function absorbUnit(blackHoleUnit, target)
{
    console.log('absorbUnit');
    target.isSwallowed = true;

    // 물리 끄기
    target.isSensor = true;
    Body.setStatic(target, true);
    Body.setVelocity(target, { x: 0, y: 0 });

    // 나선형 흡수 애니메이션을 위한 거리와 각도 세팅
    const vecInitDist = Vector.sub(target.position, blackHoleUnit.position);   // blackHole→target
    let curRadius = Vector.magnitude(vecInitDist);
    let curAngle = Math.atan2(vecInitDist.y, vecInitDist.x);

    // 애니메이션 효과 (크기 축소 + 나선형으로 중심으로 이동)
    const swallowUpdate = () => {
        // 내 블랙홀 소멸했어? 유닛 파괴, 이벤트 해제
        if (!Composite.allBodies(world).includes(blackHoleUnit))
        {
            Composite.remove(world, target);
            Events.off(engine, 'beforeUpdate', swallowUpdate);
            return;
        }

        // 중심으로 이동
        curAngle += BLACKHOLE_ROTATION_SPEED;
        curRadius *= BLACKHOLE_SRINK_SPEED;
        const newX = blackHoleUnit.position.x + curRadius * Math.cos(curAngle);
        const newY = blackHoleUnit.position.y + curRadius * Math.sin(curAngle);

        Body.setPosition(target, { x: newX, y: newY });

        // 크기 축소
        Body.scale(target, BLACKHOLE_SCALE_DIM, BLACKHOLE_SCALE_DIM);

        // 아주 작아지거나 중심에 가까워지면 삭제
        if (target.circleRadius < 1 || curRadius < target.circleRadius)
        {
            Composite.remove(world, target);
            updateScore(LEVELS[target.level].score);
            Events.off(engine, 'beforeUpdate', swallowUpdate);
            return;
        }
    };

    Events.on(engine, 'beforeUpdate', swallowUpdate);
}

function updateScore(addScore)
{
    score += addScore;
    document.getElementById('score').innerText = `Score: ${score}`;
}
//#endregion

//#region 마우스 이벤트
// 마우스 이동 이벤트
canvas.addEventListener('mousemove', (e) =>{
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (BASE_WIDTH / rect.width);
    isMouseIn = true;
});

// 마우스 클릭 이벤트
canvas.addEventListener('mousedown', (e) => {
    if (isSpawning)
    {
        return;
    }

    const rect = canvas.getBoundingClientRect();
    // 유닛 드랍
    spawnUnit(mouseX, DROP_Y, nextUnitType, nextUnitLevel);
    isSpawning = true;
    nextUnitType = Math.random() > 0.5 ? UnitType.JUNG : UnitType.BAN;
    nextUnitLevel = Math.random() <= DROP_LV1_RATIO ? 1 : 0;
    // document.getElementById('nextType').innerText = `Next: ${nextUnitType}`;

    setTimeout(() => {
        isSpawning = false;
    }, SPAWN_DELAY_MILLI);
});

//#endregion