export function buildPercept(world) {
    const { x, y } = world.agent;
    const isBlocked = (nx, ny) => {
        const out = nx < 0 || ny < 0 || nx >= world.width || ny >= world.height;
        if (out)
            return true;
        return world.obstacles.some(o => o.x === nx && o.y === ny);
    };
    return {
        agent: { ...world.agent },
        target: { ...world.target },
        blocked: {
            up: isBlocked(x, y - 1),
            down: isBlocked(x, y + 1),
            left: isBlocked(x - 1, y),
            right: isBlocked(x + 1, y)
        },
        done: world.done
    };
}
