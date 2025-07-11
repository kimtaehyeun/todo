const { dbGet, dbAll } = require("../utils/dbHelpers");
const { logSystemAction } = require("../utils/handleError");
const { LOG_ACTIONS } = require("../utils/logActions");

exports.getApprovers = async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    logSystemAction(
      req,
      req.user,
      LOG_ACTIONS.ERROR,
      "사용자 ID 없음",
      "error"
    );
    return res.status(400).json({ error: "사용자 정보가 없습니다." });
  }

  try {
    // 사용자 부서 확인
    const userRow = await dbGet(
      `SELECT department_code FROM users WHERE id = ?`,
      [userId]
    );
    if (!userRow) {
      logSystemAction(
        req,
        req.user,
        LOG_ACTIONS.ERROR,
        "사용자 정보 없음",
        "error"
      );
      return res.status(500).json({ error: "사용자 정보 없음" });
    }

    const { department_code } = userRow;

    // 원하는 직급 코드 우선순위
    const allowedCodes = ["DIR", "LEAD", "DEPHEAD"];
    const codeOrder = {
      DIR: 3, // 부장 → 가장 나중
      LEAD: 2, // 팀장
      DEPHEAD: 1, // 파트장 → 가장 먼저
    };

    // 쿼리 실행
    const sql = `
      SELECT u.id, u.name, u.position_code, cc.label AS position_label
      FROM users u
      JOIN common_codes cc ON cc.code_group = 'POSITION' AND cc.code = u.position_code
      WHERE u.status = 'ACTIVE'
        AND u.department_code = ?
        AND u.id != ?
        AND u.position_code IN (${allowedCodes.map(() => "?").join(",")})
    `;
    const approversRaw = await dbAll(sql, [
      department_code,
      userId,
      ...allowedCodes,
    ]);

    // 코드 우선순위 기준 정렬
    const approvers = approversRaw.sort(
      (a, b) =>
        (codeOrder[a.position_code] || 99) - (codeOrder[b.position_code] || 99)
    );

    logSystemAction(
      req,
      req.user,
      LOG_ACTIONS.READ,
      `결재자 선택 목록 조회: ${approvers.length}명`,
      "info"
    );

    res.json({ approvers });
  } catch (err) {
    logSystemAction(
      req,
      req.user,
      LOG_ACTIONS.ERROR,
      `결재자 조회 실패: ${err.message}`,
      "error"
    );
    return res.status(500).json({ error: "결재자 조회 실패" });
  }
};

/**
 * 팀원 정보 조회
 * @route GET /api/user/team-members
 * @desc 현재 사용자의 팀에 속한 모든 팀원 정보를 조회
 */
exports.getTeamMembers = async (req, res) => {
  const userId = req.user?.id;
  const { team_code } = req.query;

  if (!userId) {
    logSystemAction(
      req,
      req.user,
      LOG_ACTIONS.ERROR,
      "사용자 ID 없음",
      "error"
    );
    return res.status(400).json({ error: "사용자 정보가 없습니다." });
  }

  try {
    // 사용자 팀 정보 확인
    const userRow = await dbGet(
      `SELECT team_code, department_code FROM users WHERE id = ?`,
      [userId]
    );
    
    if (!userRow) {
      logSystemAction(
        req,
        req.user,
        LOG_ACTIONS.ERROR,
        "사용자 정보 없음",
        "error"
      );
      return res.status(500).json({ error: "사용자 정보 없음" });
    }

    const targetTeamCode = team_code || userRow.team_code;

    // 팀원 정보 조회
    const sql = `
      SELECT 
        u.id,
        u.name,
        u.position_code,
        u.team_code,
        u.department_code,
        cc.label AS position_label
      FROM users u
      LEFT JOIN common_codes cc ON cc.code_group = 'POSITION' AND cc.code = u.position_code
      WHERE u.status = 'ACTIVE'
        AND u.team_code = ?
      ORDER BY 
        CASE u.position_code
          WHEN 'LEAD' THEN 1
          WHEN 'MGR' THEN 2
          WHEN 'STAFF' THEN 3
          ELSE 4
        END,
        u.name
    `;

    const teamMembers = await dbAll(sql, [targetTeamCode]);

    logSystemAction(
      req,
      req.user,
      LOG_ACTIONS.READ,
      `팀원 정보 조회: ${teamMembers.length}명 (팀: ${targetTeamCode})`,
      "info"
    );

    res.json(teamMembers);
  } catch (err) {
    logSystemAction(
      req,
      req.user,
      LOG_ACTIONS.ERROR,
      `팀원 조회 실패: ${err.message}`,
      "error"
    );
    return res.status(500).json({ error: "팀원 조회 실패" });
  }
};
