import { App } from "./core/App.js";
import { RedirectPage, TitlePage } from "./core/Page.js";

declare global {
	interface ParentNode {
		replaceChildren(...nodes: (Node | string)[]): void;
	}
}

export class DefaultPage extends TitlePage {
	show() {
		super.show();
		this.app.view.content.innerHTML = "<section>PAGE NOT FOUND</section>";
	}
}

export class LoginPage extends TitlePage {
	constructor(app: App) {
		super(app, {title: "Login"});
	}

	show() {
		super.show();
		this.app.view.clearCareer();
		this.app.view.clearBackLink();
		this.app.templateEngine.get("login")
			.then(frag => {
				const form = <HTMLFormElement>frag.getElementById("loginForm");
				form.addEventListener("submit", (e) => {
					e.preventDefault();
					this._login();
				});
				this.app.view.content.replaceChildren(frag);
			});
	}

	_login(): void {
		this.app.login(
			(<HTMLInputElement>document.getElementById("person_code")).value,
			(<HTMLInputElement>document.getElementById("password")).value,
			(<HTMLInputElement>document.getElementById("all_day")).checked)
			.then(({data, error}) => {
				if(error == null)
					this.app.navigateTo("/inside/careers");
				else {
					document.getElementById("login_error")!
						.replaceChildren(document.createTextNode(error.cause!.message));
					console.error(error);
				}
			})
	}
}

export class LogoutPage extends RedirectPage {
	show() {
		this.app.logout();
		super.show();
	}
}

export class CareersPage extends TitlePage {
	constructor(app: App) {
		super(app, {title: "Careers"});
	}

	show() {
		super.show();
		this.app.view.clearCareer();
		this.app.view.clearBackLink();
		this.app.templateEngine.get("careers")
			.then(frag => {
				this._fill(frag);
				this.app.view.content.replaceChildren(frag);
			});
	}

	_fill(frag: DocumentFragment) {
		const table = <HTMLTableElement>frag.getElementById("careers_tbody");
		const careers = this.app.identity!.careers;
		for(const career of careers) {
			const tr = table.insertRow();
			tr.insertCell().innerText = career.id as unknown as string;
			const role = tr.insertCell();
			role.innerText = career.role[0].toUpperCase() + career.role.slice(1);
			if(career.major != null)
				tr.insertCell().innerText = career.major;
			else
				role.colSpan = 2;
			const link_td = tr.insertCell();
			const link_a = document.createElement("a");
			link_a.className = "symbol data-link";
			link_a.href = `${career.role}/${career.id}/`;
			link_a.innerText = "➡";
			link_td.appendChild(link_a);
		}
	}
}

export abstract class ExamsPage extends TitlePage {
	constructor(app: App) {
		super(app, {title: "Exams"});
	}

	show({id, year}: {id: string, year: string}) {
		super.show();
		this.app.view.clearBackLink();
		Promise.all([
			this.app.templateEngine.get("exams"),
			this._getExams(+id, +year)
		]).then(([frag, res]) => {
			if(res.error) {
				throw res.error;
			}
			this._fillTable(frag, res.data!);
			this._fillForm(frag, year);
			this.app.view.content.replaceChildren(frag);
		}).catch(e => {
			console.error(e);
			this.app.redirectTo("/inside/careers");
		});
	}

	_fillTable(frag: DocumentFragment, courses: CourseExams[]) {
		const tbody = <HTMLTableElement>frag.getElementById("exams_tbody");
		for(const [i, course] of courses.entries()) {
			for(const [j, exam] of course.exams.entries()) {
				const tr = tbody.insertRow();
				if(!j) {
					const courseId_th = document.createElement("th");
					const courseName_th = document.createElement("th");
					tr.append(courseId_th, courseName_th);
					courseId_th.innerText = course.id as unknown as string;
					courseName_th.innerText = course.name;
					courseId_th.className = courseName_th.className = i % 2 ? "odd" : "even";
					courseId_th.rowSpan = courseName_th.rowSpan = course.exams.length;
				}
				const id_td = tr.insertCell();
				id_td.innerText = exam.id as unknown as string;
				const date_td = tr.insertCell();
				const date = new Date(exam.date);
				date_td.innerText = date.toLocaleDateString(navigator.language, {day: "numeric", month: "long", year: "numeric"});
				const link_td = tr.insertCell();
				const link_a = document.createElement("a");
				link_a.className = "symbol data-link";
				link_a.href = `exam/${exam.id}`;
				link_a.innerText = "➡";
				link_td.appendChild(link_a);
			}
		}
	}

	_fillForm(frag: DocumentFragment, year: string) {
		const input = <HTMLInputElement>frag.getElementById("year");
		input.value = year;
		const form = <HTMLFormElement>frag.getElementById("year_form");
		form.addEventListener("submit", (e) => {
			e.preventDefault();
			this.app.navigateTo(input.value);
		});
	}

	abstract _getExams(id: number, year: number): Promise<APIResponse<CourseExams[]>>;
}

export class StudentExamsPage extends ExamsPage {
	async _getExams(id: number, year: number): Promise<APIResponse<CourseExams[]>> {
		return this.app.model.getStudCoursesExams(id, year);
	}
}

export class ProfessorExamsPage extends ExamsPage {
	async _getExams(id: number, year: number): Promise<APIResponse<CourseExams[]>> {
		return this.app.model.getProfCoursesExams(id, year);
	}
}

export class StudentExamRegistrationPage extends TitlePage {
	constructor(app: App) {
		super(app, {title: "Exam Registration"});
	}

	show({id, examId}: {id: string, examId: string}) {
		super.show();
		Promise.all([
			this.app.templateEngine.get("exam_tab"),
			this.app.model.getStudExam(+id, +examId)
		]).then(([frag, res]) => {
			if(res.error) {
				throw res.error;
			}
			const exam = res.data!;
			_fillExam(frag, exam);
			this.app.view.content.replaceChildren(frag);
			this.app.view.showBackLink("Exams", `../../${exam.year}`);
			return this._getStudExamReg(+id, +examId);
		}).then(frag => {
			this.app.view.content.append(frag);
		}).catch(e => {
			console.error(e);
			this.app.redirectTo("..");
		});
	}

	async _getStudExamReg(id: number, examId: number) {
		const res = await this.app.model.getStudExamReg(id, examId);
		if(res.error) {
			throw res.error;
		}
		const reg = res.data!;

		let frag;
		if(reg == null) {
			frag = await this.app.templateEngine.get("exam_unregistered");
			frag.getElementById("register_form")!.addEventListener("submit", e => {
				e.preventDefault();
				this.app.model.registerStudToExamReg(id, examId)
					.then(_res => {
						if(_res.error != null)
							throw _res.error;
						if(!_res.data)
							console.warn("Operation did not succeed");
						this.app.redirectTo("");
					});
			});
		}
		else if(reg.result == "VUOTO") {
			frag = await this.app.templateEngine.get("exam_unpublished");
			frag.getElementById("deregister_form")!.addEventListener("submit", e => {
				e.preventDefault();
				this.app.model.deregisterStudFromExamReg(id, examId)
					.then(_res => {
						if(_res.error != null)
							throw _res.error;
						if(!_res.data)
							console.warn("Operation did not succeed");
						this.app.redirectTo("");
					});
			});
		}
		else {
			frag = await this.app.templateEngine.get("exam_evaluation");
			const reject_form = frag.getElementById("reject_form")!;
			frag.getElementById("registration_status")!.innerText = getStatusString(reg.status);
			frag.getElementById("registration_grade")!.innerText =  getGradeString(reg.resultRepresentation);
			if(reg.status == "PUB" && reg.result == "PASS") {
				reject_form.addEventListener("submit", e => {
					e.preventDefault();
					this.app.model.rejectStudExamReg(id, examId)
						.then(_res => {
							if(_res.error != null)
								throw _res.error;
							if(!_res.data)
								console.warn("Operation did not succeed");
							this.app.redirectTo("");
						});
				});
			} else {
				reject_form.remove();
			}
		}
		return frag;
	}
}

export class ProfEditExamPage extends TitlePage {
	constructor(app: App) {
		super(app, {title: "Edit Exam Registration"});
	}

	show({id, examId, studentId}: {id: string, examId: string, studentId: string}) {
		super.show();

		Promise.all([
			Promise.all([
				this.app.templateEngine.get("exam_tab"),
				this.app.model.getProfExam(+id, +examId)
			]).then(([frag, res]) => {
				if(res.error) {
					throw res.error;
				}
				const exam = res.data!;
				_fillExam(frag, exam);
				return frag;
			}),
			Promise.all([
				this.app.templateEngine.get("single_edit"),
				this.app.model.getProfExamRegistration(+id, +examId, +studentId)
			]).then(([frag, res]) => {
				if(res.error) {
					throw res.error;
				}
				const examReg = res.data!;
				this._fill(frag, id, examId, examReg);
				return frag;
			})
		]).then(([examTableFrag, singleEditFrag]) => {
			this.app.view.content.replaceChildren(examTableFrag, singleEditFrag);
			this.app.view.showBackLink("Exam Registrations", `..`);
		}).catch((resError) => {
			console.error(resError);
			this.app.redirectTo(`..`);
		});
	}

	_fill(frag: DocumentFragment, professorId: string, examId: string, examRegistration: ExamRegistrationCareer) {
		{
			const career = examRegistration.career;
			const user = examRegistration.career.user;
			frag.getElementById("student_id")!.innerText = career.id as unknown as string;
			frag.getElementById("person_code")!.innerText = user.personCode;
			frag.getElementById("name")!.innerText = user.name;
			frag.getElementById("surname")!.innerText = user.surname;
		}
		{
			const select = frag.getElementById("examResult")! as HTMLSelectElement;
			const allExamResults : ExamResult[] = ['VUOTO', 'ASS', 'RM', 'RP', 'PASS'];
			for(const examResult of allExamResults){
				const option : HTMLOptionElement = new Option(getResultData(examResult).string, examResult)
				select.add(option);

				if(examResult == examRegistration.result){
					option.setAttribute("selected", "selected");
				}
			}
			(frag.getElementById("grade")! as HTMLInputElement).value = examRegistration.grade as unknown as string;
			(frag.getElementById("laude")! as HTMLInputElement).checked = examRegistration.laude;

			const submitButton = (frag.getElementById("submit")! as HTMLInputElement);
			submitButton.addEventListener("click", (e: MouseEvent) => {
					e.preventDefault();
				const examResult = (document.getElementById("examResult")! as HTMLSelectElement).value as ExamResult;
				const grade = (document.getElementById("grade")! as HTMLInputElement).value as unknown as number;
				const laude = (document.getElementById("laude")! as HTMLInputElement).checked
				const examEval : ExamEvaluation = [examRegistration.studentId, examResult, grade, laude];

				const errorDiv = document.getElementById("edit_error")! as HTMLDivElement;
				errorDiv.textContent = "";
				const check = _inputCheck(examEval);
				if(!check.correct){
					for (const error of check.errors) {
						const errorP = document.createElement("p");
						errorP.innerText = error;
						errorDiv.appendChild(errorP);
					}
					return;
				}

				const result = this.app.model.editProfExamRegistrations(+professorId, +examId, [examEval]);
				result.then(({data, error}) => {
					if(error != null || !data){
						this.app.redirectTo(`./${examRegistration.studentId}`);
						return;
					}
					this.app.navigateTo(`..`);
				})
			});
		}
	}
}

function _inputCheck(examEval : ExamEvaluation) : {correct: boolean, errors: string[]} {
	let check : {correct: boolean, errors: string[]} = {correct: true, errors: []};

	const examResult = examEval[1];
	const grade : number = examEval[2];
	const laude : boolean = examEval[3];

	switch(examResult){
		case "VUOTO":
			if(grade != 0){
				check.correct = false;
				check.errors.push("Grade should be 0 with EMPTY exam");
			}
			break;
		case "ASS":
			if(grade != 0){
				check.correct = false;
				check.errors.push("Grade should be 0 on ABSENT student");
			}
			break;
		case "PASS":
		if(grade < 18){
			check.correct = false;
			check.errors.push("Grade should be greater than 18 on PASSED exam");
		}
	}

	if(laude && grade!= 30){
		check.correct = false;
		check.errors.push("Laude cannot be given with a grade lower than 30");
	}

	return check;
}

type Column = {
	name: string,
	compare: (examReg1: ExamRegistrationCareer, examReg2: ExamRegistrationCareer) => number,
	ascending: boolean,
}
export class ProfExamRegistrationsPage extends TitlePage {
	constructor(app: App) {
		super(app, {title: "Exam Registration"});
	}

	_currColumn? : Column;
	_columns : Column[] = [
		{
			name: "Student ID",
			compare: (examReg1 : ExamRegistrationCareer, examReg2 : ExamRegistrationCareer) : number => {
				return examReg1.studentId - examReg2.studentId;
			},
			ascending : false,
		},
		{
			name: "Name",
			compare: (examReg1 : ExamRegistrationCareer, examReg2 : ExamRegistrationCareer) : number => {
				return (examReg1.career.user.name >= examReg2.career.user.name) ? 1 : -1;
			},
			ascending : false,
		},
		{
			name: "Surname",
			compare: (examReg1 : ExamRegistrationCareer, examReg2 : ExamRegistrationCareer) : number => {
				return (examReg1.career.user.surname >= examReg2.career.user.surname) ? 1 : -1;
			},
			ascending : false,
		},
		{
			name: "Email",
			compare: (examReg1 : ExamRegistrationCareer, examReg2 : ExamRegistrationCareer) : number => {
				return (examReg1.career.user.email >= examReg2.career.user.email) ? 1 : -1;
			},
			ascending : false,
		},
		{
			name: "Major",
			compare: (examReg1 : ExamRegistrationCareer, examReg2 : ExamRegistrationCareer) : number => {
				return (examReg1.career.major! >= examReg2.career.major!) ? 1 : -1;
			},
			ascending : false,
		},
		{
			name: "Status",
			compare: (examReg1 : ExamRegistrationCareer, examReg2 : ExamRegistrationCareer) : number => {
				return getStatusData(examReg1.status).value - getStatusData(examReg2.status).value;
			},
			ascending : false,
		},
		{
			name: "Grade",
			compare: (examReg1 : ExamRegistrationCareer, examReg2 : ExamRegistrationCareer) : number => {
				const resultCompare = getResultData(examReg1.result).value - getResultData(examReg2.result).value;
				if(resultCompare == 0){
					const gradeCompare = examReg1.grade - examReg2.grade;
					if(gradeCompare == 0){
						return +examReg1.laude - +examReg2.laude;
					}else{
						return gradeCompare;
					}
				}else{
					return resultCompare;
				}
			},
			ascending : false,
		}
	];
	_registrations : ExamRegistrationCareer[] = [];
	_registrationsTBody!: HTMLTableElement;
	_multiinsertTBody!: HTMLTableElement;

	show({id, examId}: {id: string, examId: string}) {
		super.show();

		Promise.all([
			Promise.all([
				this.app.templateEngine.get("exam_tab"),
				this.app.model.getProfExam(+id, +examId)
			]).then(([frag, res]) => {
				if(res.error) {
					throw res.error;
				}
				const exam = res.data!;
				_fillExam(frag, exam);
				this.app.view.showBackLink("Exams", `../../${exam.year}`);
				return frag;
			}),
			Promise.all([
				this.app.templateEngine.get("registrations"),
				this.app.model.getProfExamRegistrations(+id, +examId)
			]).then(([frag, res]) => {
				if(res.error != null){
					throw res.error;
				}
				this._registrations = res.data!;
				this._registrationsTBody = frag.getElementById("registrations_tbody") as HTMLTableElement;
				this._multiinsertTBody = frag.getElementById("multiinsert_tbody") as HTMLTableElement;
				this._fill(frag, id, examId);
				return frag;
			})
		]).then(([examtab, regs]) => {
				this.app.view.content.replaceChildren(examtab, regs);
				this._sortTable();
		}).catch((resError) => {
			console.error(resError);
			this.app.redirectTo(`..`);
		});
	}

	_fill(frag: DocumentFragment, professorId: string, examId: string) {
		{
			const headersRow = frag.getElementById("registrations_headers_trow")! as HTMLTableRowElement;
			for(const column of this._columns){
				const header = this._createHeaderCell(column);
				headersRow.append(header);
			}
			const editHeader = document.createElement("th");
			editHeader.append(document.createTextNode("Edit exam result"));
			editHeader.setAttribute("scope", "col");
			headersRow.append(editHeader);
		}
		{
			const publishSubmit = frag.getElementById("publish_submit")! as HTMLInputElement;
			publishSubmit.addEventListener("click", (e: MouseEvent) => {
				e.preventDefault();
				this.app.model.publishProfExamRegistrations(+professorId, +examId)
				.then(() => this.app.navigateTo(`.`));
			});
			const verbalizeSubmit = frag.getElementById("verbalize_submit")! as HTMLInputElement;
			verbalizeSubmit.addEventListener("click", (e: MouseEvent) => {
				e.preventDefault();
				this.app.model.verbalizeProfExamRegistrations(+professorId, +examId)
				.then(() => this.app.navigateTo("records"));
			});
			const multiInsert = frag.getElementById("multiinsert_submit")! as HTMLInputElement;
			const multiInsertForm = frag.getElementById("multiinsert_form")! as HTMLFormElement;
			multiInsert.addEventListener("click", (e: MouseEvent) => {
				const formData = new FormData(multiInsertForm);
				multiInsertForm.querySelectorAll("input[type=checkbox]").forEach((el) => formData.append("laude", (el as HTMLInputElement).checked ? "true" : ""));

				const dataValues = {
					studId: formData.getAll("studId"),
					examResult: formData.getAll("examResult"),
					grade: formData.getAll("grade"),
					laude: formData.getAll("laude"),
				}

				const examEvals: ExamEvaluation[] = dataValues.studId.map((studId, i) => [
					+studId.valueOf(),
					dataValues.examResult[i].valueOf() as ExamResult,
					+dataValues.grade[i].valueOf(),
					!!dataValues.laude[i].valueOf()
				]);

				const errorDiv = document.getElementById("edit_error")! as HTMLDivElement;
				errorDiv.innerText = "";
				let errorF = false;
				for(const examEval of examEvals) {
					const check = _inputCheck(examEval);
					if(!check.correct){
						errorF = true;
						const errorP = document.createElement("p");
						errorDiv.appendChild(errorP);
						errorP.innerText = `Student ${examEval[0]}:`;
						for (const error of check.errors) {
							errorP.innerText += `\n  ${error}`;
						}
					}
				}
				if(errorF) {
					e.preventDefault();
					return;
				}

				const result = this.app.model.editProfExamRegistrations(+professorId, +examId, examEvals);
				result.then(({data, error}) => {
					if(error != null) {
						const errorP = document.createElement("p");
						errorP.innerText = error.message;
						errorDiv.appendChild(errorP);
						e.preventDefault();
						return;
					}
					this.app.redirectTo("");
				})
			});
		}
	}

	_createHeaderCell(column: Column) : HTMLTableHeaderCellElement {
		const headerCell = document.createElement("th");
		headerCell.setAttribute("scope", "col");
		headerCell.setAttribute("id", column.name);
		headerCell.style.userSelect = "none";
		headerCell.style.cursor = "pointer";
		headerCell.innerText = column.name;

		headerCell.addEventListener("click", (e: MouseEvent) => {
			if(this._currColumn != null){
				document.getElementById(this._currColumn.name)!.innerText = this._currColumn.name;
			}

			column.ascending = !column.ascending;
			this._currColumn = column;
			headerCell.innerText = `${column.name} ${column.ascending ? '▲' : '▼'}`;
			this._sortTable();
		});

		return headerCell;
	}

	_sortTable(){
		if(this._currColumn != null){
			this._registrations.sort(this._currColumn.compare);
			if(!this._currColumn.ascending){
				this._registrations.reverse();
			}
		}
		this._registrationsTBody.replaceChildren();
		this._multiinsertTBody.replaceChildren();
		for(const examRegistration of this._registrations){
			const trow = this._registrationsTBody.insertRow();

			for(const text of [
				examRegistration.career.id,
				examRegistration.career.user.name,
				examRegistration.career.user.surname,
				examRegistration.career.user.email,
				examRegistration.career.major,
				getStatusData(examRegistration.status).string,
				examRegistration.resultRepresentation,
			] as string[]) {
				const tcell = trow.insertCell();
				tcell.innerText = text;
			}

			const tcell_link = trow.insertCell();
			switch(examRegistration.status){
				case 'PUB':
					tcell_link.innerText = "Exam result has been published";
					break;
				case 'VERB':
					tcell_link.innerText = "Exam result has been finalized";
					break;
				default:
					const a = document.createElement("a");
					a.className = "symbol data-link";
					a.href = `reg/${examRegistration.studentId}`;
					a.innerText = "➡";
					tcell_link.appendChild(a);
			}
			if(examRegistration.status == "NINS") {
				const mrow = this._multiinsertTBody.insertRow();
				for(const text of [
					examRegistration.career.id,
					examRegistration.career.user.name,
					examRegistration.career.user.surname,
				] as string[]) {
					const tcell = mrow.insertCell();
					tcell.innerText = text;
				}

				const studId_input = document.createElement("input");
				const result_cell = mrow.insertCell();
				const result_input = document.createElement("select");
				result_cell.append(studId_input, result_input);
				const grade_cell = mrow.insertCell();
				const grade_input = document.createElement("input");
				grade_cell.append(grade_input);
				const laude_cell = mrow.insertCell();
				const laude_input = document.createElement("input");
				laude_cell.append(laude_input);

				for(const examResult of ['VUOTO', 'ASS', 'RM', 'RP', 'PASS'] as ExamResult[]){
					const option : HTMLOptionElement = new Option(getResultData(examResult).string, examResult)
					result_input.add(option);
					if(examResult == examRegistration.result)
						option.selected = true;
				}

				studId_input.type = "hidden";
				studId_input.name = "studId";
				studId_input.value = examRegistration.career.id as unknown as string;

				result_input.name = "examResult";
				result_input.size = 1;
				
				grade_input.type = "number";
				grade_input.min = "0";
				grade_input.max = "30";
				grade_input.name = "grade";
				grade_input.value = examRegistration.grade as unknown as string;
				
				laude_input.type = "checkbox";
				//laude_input.name = "laude";
				laude_input.value = "true";
				laude_input.checked = examRegistration.laude;
			}
		}
	}
}

export class RecordsPage extends TitlePage {
	constructor(app: App) {
		super(app, {title: "Records"});
	}

	show({id, examId}: {id: string, examId: string}) {
		super.show();
		this.app.view.showBackLink("Exam Registrations", ".");
		Promise.all([
			Promise.all([
				this.app.templateEngine.get("exam_tab"),
				this.app.model.getProfExam(+id, +examId)
			]).then(([frag, res]) => {
				if(res.error) {
					throw res.error;
				}
				const exam = res.data!;
				_fillExam(frag, exam);
				return frag;
			}),
			Promise.all([
				this.app.templateEngine.get("records"),
				this.app.model.getProfExamRecords(+id, +examId)
			]).then(([frag, res]) => {
				if(res.error) {
					throw res.error;
				}
				this._fillTable(frag, res.data!);
				return frag;
			})
		]).then(([examtab, records]) => {
				this.app.view.content.replaceChildren(examtab, records);
		}).catch((resError) => {
			console.error(resError);
			this.app.redirectTo(`..`);
		}).catch(e => {
			console.error(e);
			this.app.redirectTo(".");
		});
	}

	_fillTable(frag: DocumentFragment, records: ExamRecord[]) {
		const tbody = <HTMLTableElement>frag.getElementById("records_tbody");
		for(const [i, record] of records.entries()) {
			for(const [j, reg] of record.examRegistrations.entries()) {
				const tr = tbody.insertRow();
				if(!j) {
					const recordId_th = document.createElement("th");
					const recordTime_th = document.createElement("th");
					tr.append(recordId_th, recordTime_th);
					recordId_th.innerText = record.id as unknown as string;
					recordTime_th.innerText = record.time;
					const time = new Date(record.time);
					recordTime_th.innerText = time.toLocaleString(navigator.language, {day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit"});
					recordId_th.className = recordTime_th.className = i % 2 ? "odd" : "even";
					recordId_th.rowSpan = recordTime_th.rowSpan = record.examRegistrations.length;
				}
				const id_td = tr.insertCell();
				id_td.innerText = reg.studentId as unknown as string;
				const name_td = tr.insertCell();
				name_td.innerText = reg.career.user.name;
				const surname_td = tr.insertCell();
				surname_td.innerText = reg.career.user.surname;
				const grade_td = tr.insertCell();
				grade_td.innerText = getGradeString(reg.resultRepresentation);
			}
		}
	}
}

function _fillExam(frag: DocumentFragment, exam: ExamCourse) {
	frag.getElementById("course_id")!.innerText = exam.course.id as unknown as string;
	frag.getElementById("course_name")!.innerText = exam.course.name;
	frag.getElementById("exam_id")!.innerText = exam.id as unknown as string;
	const date = new Date(exam.date);
	frag.getElementById("exam_date")!.innerText = date.toLocaleDateString(navigator.language, {day: "numeric", month: "long", year: "numeric"});
}

function getStatusData(status: ExamStatus): {value: number, string: string} {
	return {
		NINS: {value: 0, string: "NOT INSERTED"},
		INS: {value: 1, string: "INSERTED"},
		PUB: {value: 2, string: "PUBLISHED"},
		RIF: {value: 3, string: "REJECTED"},
		VERB: {value: 4, string: "VERBALIZED"},
	}[status];
}

function getResultData(result: ExamResult): {value: number, string: string} {
	return {
		VUOTO: {value: 0, string: "EMPTY"},
		ASS: {value: 1, string: "ABSENT"},
		RM: {value: 2, string: "POSTPONED"},
		RP: {value: 3, string: "TO SIT AGAIN"},
		PASS: {value: 4, string: "PASSED"},
	}[result];
}

function getGradeString(resultRepresentation: string): string {
	return getResultData(resultRepresentation as unknown as ExamResult)?.string ?? resultRepresentation;
}

function getStatusString(status: ExamStatus): string {
	return getStatusData(status).string;
}
