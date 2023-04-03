type IRI = string;

type Collection<T> = {
	totalItems: number;
	prev?: IRI;
	next?: IRI;
	items: T[];
};

type Author = {
	id: IRI;
	name: string;
	profilePicture: string;
	posts: IRI;
	whenJoined: Date;
};

type PostBase = {
	id: IRI;
	whenCreated: Date;
	comments: IRI;
};

type Post = (
	| {
			isDeleted: false;
			author: IRI | null;
			postBody: string;
	  }
	| {
			isDeleted: true;
	  }
) &
	PostBase;

type PostComment = (
	| {
			isDeleted: false;
			author: IRI | null;
			postBody: string;
			inReplyTo: IRI;
	  }
	| {
			isDeleted: true;
	  }
) &
	PostBase;
