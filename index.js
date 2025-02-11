let scene, camera, renderer, controls;
let player;            // 玩家精灵
let obstacles = [];    // 障碍物数组
let score = 0;         // 游戏得分
let gameIsRunning = false;

// ============ 跳跃相关变量 ============
let isJumping = false;
let velocityY = 0;     
const jumpPower = 0.4; 
const gravity = 0.02;  

// 玩家移动相关
let moveLeft = false, moveRight = false;
const moveSpeed = 0.15;   
let obstacleSpeed = 0.2;  
const obstacleSpeedIncrease = 0.001; 
const maxObstacleSpeed = 1.2; 

// 游戏设定
let spawnInterval = 1000;       
const spawnIntervalDecrement = 50; 
const minSpawnInterval = 10;    
let spawnTimer = null;
let gameLoopId = null;     
let flag = true;    

// ========== 不同角色的配置（增加 thumbnail 和 description） ==========
const roles = [
  {
    name: 'Taritsu',
    texture: 'assets/taritsu.webp',       // 游戏内使用的纹理
    music: 'assets/ac.mp3',        // 对应的背景音乐
    thumbnail: 'assets/taritsu.webp',  // 角色缩略图（在面板上显示）
    description: '擅长高速移动，跳跃力一般，适合喜欢速度的玩家。'
  },
  {
    name: 'Linka',
    texture: 'assets/linka.webp',
    music: 'assets/cy.mp3',
    thumbnail: 'assets/linka.webp',
    description: '跳跃力更强，能够更轻松地越过较高障碍物。'
  },
  {
    name: 'Maya',
    texture: 'assets/maya.webp',
    music: 'assets/sing.mp3',
    thumbnail: 'assets/maya.webp',
    description: '平衡型角色，速度和跳跃均衡，适合大多数情况。'
  },
  {
    name: "???",
    texture: "assets/tempest.webp",
    music: "assets/tempest.mp3",
    thumbnail: "assets/tempest.webp",
    description: '未知的力量'
  }
];

// 当前选中的角色
let currentRole = null;
let bgMusic = null;  // 根据角色动态赋值

// 其他音效
const crossingSound = new Audio('assets/crossingSound.wav');    
const gameOverSound = new Audio('assets/gameOverSound.ogg');    

// 平台大小
const platformWidth = 12;
const platformDepth = 50;

function init() {
  const container = document.getElementById('gameContainer');

  // 创建场景
  scene = new THREE.Scene();

  // 使用一个纹理作为背景
  const loader = new THREE.TextureLoader();
  loader.load(
    'assets/bg.webp', // 可换为自己的背景图
    function(texture) {
      scene.background = texture;
    }
  );

  // 创建相机
  camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    200
  );
  camera.position.set(0, 6, 12);
  camera.lookAt(0, 0, 0);

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // 控制器（可选，用于调试）
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enablePan = false;    
  controls.minDistance = 5;      
  controls.maxDistance = 50;

  // 监听浏览器大小变化
  window.addEventListener('resize', onWindowResize);

  // 添加光源
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(0, 10, 10);
  scene.add(dirLight);

  // 添加平台
  const textureLoader = new THREE.TextureLoader();
  const roadTexture = textureLoader.load('assets/road.jpg');  
  roadTexture.wrapS = THREE.RepeatWrapping;
  roadTexture.wrapT = THREE.RepeatWrapping;
  roadTexture.repeat.set(4, 16);
  const platformMat = new THREE.MeshPhongMaterial({
    map: roadTexture,
  });
  const platformGeo = new THREE.BoxGeometry(platformWidth, 0.5, platformDepth);
  const platform = new THREE.Mesh(platformGeo, platformMat);
  platform.position.set(0, -0.5, 0);
  scene.add(platform);

  // ============== 创建玩家精灵（先用默认纹理，后续根据角色选择再更换） ==============
  // 如果不想有默认，可以先暂时用一张透明图或其他占位
  const defaultPlayerTexture = textureLoader.load('assets/bg.jpg'); 
  const spriteMaterial = new THREE.SpriteMaterial({
    map: defaultPlayerTexture,
    transparent: true
  });
  player = new THREE.Sprite(spriteMaterial);
  player.scale.set(2.5, 2.5, 2.5);
  player.position.set(0, 0.75, 15);
  scene.add(player);

  // 添加键盘监听
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
}

// 窗口自适应
function onWindowResize() {
  const container = document.getElementById('gameContainer');
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

// 键盘按下
function onKeyDown(e) {
  if (!gameIsRunning) return;
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    moveLeft = true;
  }
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    moveRight = true;
  }
  if ((e.key === ' ' || e.code === 'Space') && !isJumping) {
    isJumping = true;
    velocityY = jumpPower;
  }
}

// 键盘抬起
function onKeyUp(e) {
  if (!gameIsRunning) return;
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    moveLeft = false;
  }
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    moveRight = false;
  }
}

// 动画循环
function gameLoop() {
  gameLoopId = requestAnimationFrame(gameLoop);

  controls.update();

  // 玩家水平移动
  if (moveLeft) {
    player.position.x -= moveSpeed;
  }
  if (moveRight) {
    player.position.x += moveSpeed;
  }

  // 跳跃物理
  if (isJumping) {
    velocityY -= gravity;
    player.position.y += velocityY;
    if (player.position.y <= 0.5) {
      player.position.y = 0.5;
      isJumping = false;
      velocityY = 0;
    }
  }

  // 防止玩家离开平台左右边界
  const halfWidth = platformWidth / 2 - 0.5;
  if (player.position.x < -halfWidth) {
    player.position.x = -halfWidth;
  }
  if (player.position.x > halfWidth) {
    player.position.x = halfWidth;
  }

  // 障碍物移动 & 检测碰撞
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.position.z += obstacleSpeed;

    // 超出玩家后面就移除
    if (obs.position.z > 20) {
      scene.remove(obs);
      obstacles.splice(i, 1);

      // 播放“成功躲过”音效
      crossingSound.currentTime = 0;
      crossingSound.play();

      score++;
      document.getElementById('score').textContent = score;

      if (flag && currentRole.name === '???' && score >= 162) {
        const loader = new THREE.TextureLoader();
        loader.load('assets/bg_tempest2.webp', function(texture) {
          scene.background = texture;
        });
        const textureLoader = new THREE.TextureLoader();
        const opponentTexture = textureLoader.load('assets/fatalis.webp'); 
        const spriteMaterial = new THREE.SpriteMaterial({
            map: opponentTexture,
            transparent: true
        });
        opponent = new THREE.Sprite(spriteMaterial);
        opponent.scale.set(15, 15, 15);
        opponent.position.set(0, 2, -5);
        scene.add(opponent);
        flag = false;

        bgMusic.pause();
        bgMusic = new Audio('assets/testify.mp3');
        bgMusic.loop = true;
        bgMusic.currentTime = 15;
        bgMusic.play();
      }

      continue;
    }

    // 碰撞检测
    if (checkCollision(player, obs)) {
      endGame();
      return;
    }
  }

  // 如果玩家掉下平台
  if (player.position.y < 0.25) {
    endGame();
    return;
  }

  followPlayer(); 
  renderer.render(scene, camera);
}

// 简易包围盒碰撞检测
function checkCollision(objA, objB) {
  const boxA = new THREE.Box3().setFromObject(objA);
  const boxB = new THREE.Box3().setFromObject(objB);
  return boxA.intersectsBox(boxB);
}

// 相机跟随玩家
function followPlayer() {
  camera.position.x = player.position.x;
  camera.position.y = player.position.y + 5;
  camera.position.z = player.position.z + 10;
  camera.lookAt(player.position);
}

// 定时生成障碍物
function spawnObstacle() {
  const width = Math.random() * 2 + 1;
  const height = Math.random() * 1.5 + 0.5;
  const depth = Math.random() * 2 + 1;

  const geometry = new THREE.BoxGeometry(width, height, depth);
  const color = new THREE.Color(Math.random(), Math.random(), Math.random());
  const material = new THREE.MeshPhongMaterial({ color });
  const obstacle = new THREE.Mesh(geometry, material);

  obstacle.position.z = -platformDepth / 2;
  const halfPlatform = platformWidth / 2 - width / 2;
  obstacle.position.x = (Math.random() - 0.5) * 2 * halfPlatform;
  obstacle.position.y = height / 2;

  scene.add(obstacle);
  obstacles.push(obstacle);

  // 障碍物速度逐渐增加
  obstacleSpeed += obstacleSpeedIncrease; 
  if (obstacleSpeed > maxObstacleSpeed) {
    obstacleSpeed = maxObstacleSpeed;
  }
}

// 开始游戏
function startGame() {
  // 如果尚未选择角色，则不执行
  if (!currentRole) {
    alert('请先选择一个角色！');
    return;
  }

  score = 0;
  flag = true;
  document.getElementById('score').textContent = score;
  document.getElementById('startBtn').style.display = 'none';
  document.getElementById('endPanel').style.display = 'none';

  // 重置玩家位置
  player.position.set(0, 0.5, 15);
  isJumping = false;
  velocityY = 0;

  // 清空障碍物
  obstacles.forEach(obs => scene.remove(obs));
  obstacles = [];

  obstacleSpeed = 0.2;
  spawnInterval = 1000;

  if (currentRole.name === '???') {
    obstacleSpeed = 0.3;
    spawnInterval = 517.2413793103;
  }

  // 播放所选角色对应的背景音乐
  bgMusic.currentTime = 0;
  bgMusic.play();
  gameOverSound.pause();

  gameIsRunning = true;
  gameLoopId = requestAnimationFrame(gameLoop);

  // 周期生成障碍物
  spawnTimer = setInterval(() => {
    spawnObstacle();
    spawnInterval = Math.max(spawnInterval - spawnIntervalDecrement, minSpawnInterval);
  }, spawnInterval);
}

// 结束游戏
function endGame() {
  gameIsRunning = false;
  cancelAnimationFrame(gameLoopId);
  clearInterval(spawnTimer);

  // 播放游戏结束音效
  gameOverSound.currentTime = 0;
  gameOverSound.play();

  // 停止背景音乐
  if (bgMusic) {
    bgMusic.pause();
  }

  document.getElementById('finalScore').textContent = score;
  document.getElementById('endPanel').style.display = 'block';
}

// 重新开始游戏
function restartGame() {
  if (currentRole.name === '???') {
    window.alert('你尚未掌握她的全部力量')
    return;
  }
  startGame();
}

// ========== 初始化角色选择功能：生成角色列表、设置点击事件等 ========== 
function initRoleSelection() {
  const roleListContainer = document.getElementById('roleListContainer');
  const previewImage = document.getElementById('previewImage');
  const roleNameEle = document.getElementById('roleName');
  const roleDescEle = document.getElementById('roleDescription');
  const confirmRoleBtn = document.getElementById('confirmRoleBtn');

  // 生成角色列表的 DOM
  roles.forEach((role, idx) => {
    const roleItem = document.createElement('div');
    roleItem.className = 'roleItem';
    roleItem.setAttribute('data-index', idx);

    // 角色缩略图
    const thumbImg = document.createElement('img');
    thumbImg.className = 'roleThumbnail';
    thumbImg.src = role.thumbnail;
    roleItem.appendChild(thumbImg);

    // 角色名称
    const nameSpan = document.createElement('span');
    nameSpan.textContent = role.name;
    roleItem.appendChild(nameSpan);

    // 点击事件：切换预览
    roleItem.addEventListener('click', () => {
      // 移除其他选中的样式
      document.querySelectorAll('.roleItem').forEach(ele => ele.classList.remove('selected'));
      // 给当前选中的加上样式
      roleItem.classList.add('selected');

      // 更新预览
      previewImage.src = role.texture;  // 这里直接用完整贴图，也可另设 role.preview 大图
      roleNameEle.textContent = role.name;
      roleDescEle.textContent = role.description;

      // 显示「确认选择」按钮
      confirmRoleBtn.style.display = 'inline-block';

      // 临时存一下该角色索引或对象，用于后续「确认选择」
      currentRole = role;
    });

    roleListContainer.appendChild(roleItem);
  });

  // 点击「确认选择」按钮后正式应用角色
  confirmRoleBtn.addEventListener('click', () => {
    if (!currentRole) {
      alert('请先在左侧选择一个角色！');
      return;
    }

    // 1. 设置背景音乐
    bgMusic = new Audio(currentRole.music);
    bgMusic.loop = true;

    if (currentRole.name === '???') {
        // 替换背景图为 bg_tempest.webp
        const loader = new THREE.TextureLoader();
        loader.load('assets/bg_tempest.webp', function(texture) {
          scene.background = texture;
        });
    }

    // 2. 更新玩家的贴图
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(currentRole.texture, (newTexture) => {
      player.material.map = newTexture;
      player.material.needsUpdate = true;
    });

    // 3. 隐藏角色选择面板，显示「开始游戏」按钮
    document.getElementById('characterSelectPanel').style.display = 'none';
    document.getElementById('startBtn').style.display = 'block';
  });
}

window.onload = () => {
  init();
  initRoleSelection();

  // 开始按钮和重新开始按钮事件
  document.getElementById('startBtn').addEventListener('click', startGame);
  document.getElementById('restartBtn').addEventListener('click', restartGame);
};